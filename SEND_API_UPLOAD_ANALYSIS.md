# Analyse - API /send : validation et sécurité des fichiers

Date : 29 novembre 2025
Auteur : Analyse automatique

## Contexte

La route API `/send/:code` est définie dans `src/api/v1/default.api.js` et passe par cette chaîne de middlewares (ordre d'exécution) :

- `authApiKeyAccess` (authentifie le site et le formulaire)
- `multipartUpload` (multer => écrit les fichiers en tmp)
- `validateUpload` (vérifie extensions et magic-bytes)
- `inspectArchive` (inspection des archives / documents office / pdf js)
- `moveFilesToUploads` (déplace les fichiers vers storage final)
- `updateFormFileKeys` (met à jour file_keys du formulaire)
- `sanitizeRequestBody` (sanitise le body reçu)
- `updateFormTemplate` (mise à jour template/columns si nécessaire)
- `sendHandler` (persiste la payload dans Inbox)

## Comportement observé

Vous reportez qu'un fichier `script.sh` renommé en `document.pdf` est accepté et sauvegardé, bien qu'il ne soit pas un vrai PDF. Après inspection du code, le flux suivant explique pourquoi :

- `multipartUpload` (multer) enregistre le fichier tel quel dans `storage/tmp/` (OK - stockage temporaire attendu).
- `validateUpload` réalise deux contrôles principaux :
    1. Vérifie que l'extension (depuis `f.originalname`) est dans la liste blanche `ALLOWED`.
    2. Tente d'identifier le type par contenu via `fileTypeFromFile(f.path)` (lib `file-type`).
        - Si `file-type` détecte une extension (ft.ext) et qu'elle ne correspond pas à l'extension déclarée, le fichier est rejeté.
        - Si `file-type` **ne détecte rien** (retourne `undefined` pour `ft`), le middleware **ne rejette pas** le fichier.

Pourquoi le `.sh` renommé en `.pdf` passe ?

- L'extension `.pdf` est dans la liste blanche `ALLOWED`, donc le contrôle d'extension ne bloque pas.
- `file-type` ne reconnaît pas un fichier texte (shell script) comme un `pdf` (ou autre type binaire) et retourne `undefined`. Le code actuel considère ce cas comme acceptable et ne refuse pas le fichier.
- `inspectArchive` effectue seulement :
    - Une heuristique pour PDF (recherche littérale du token `/JavaScript` dans le contenu lu en utf8) — ne vérifie **pas** le header `%PDF-`.
    - Une inspection des archives zippées (docx/xlsx) via `node-stream-zip` pour détecter macros/exécutables.
    - Il ne rejette pas un fichier texte renommé `.pdf` à moins qu'il contienne explicitement `/JavaScript`.

## Conclusion courte

Le comportement est attendu au vu du code actuel : fichiers textuels renommés en `.pdf` seront acceptés parce que `file-type` ne détecte pas leur type et le middleware ne traite pas ce cas comme suspect. Ce n'est pas une faille d'exécution en soi (le fichier enregistré n'est qu'un faux PDF non ouvrable), mais cela peut être problématique :

- Faux-fichiers (.sh /.php /.ps1) sauvegardés avec extension autorisée
- Risque d'injection de contenu malveillant (scripts, commandes) si l'application sert ou traite ces fichiers plus tard
- Risque d'archivage malveillant / zip bombs si archives non contrôlées

## Recommandations détaillées

Voici les actions recommandées, classées par priorité, avec exemples de code à appliquer.

## Priorité haute (à appliquer rapidement)

1. Renforcer `validateUpload` pour rejeter les fichiers quand `file-type` ne détecte rien pour les extensions dont on attend un signature (pdf, png, jpg, gif, webp, docx, xlsx, pptx)

- Raison : la plupart des formats binaires ont des signatures (magic bytes). Un fichier texte renommé en `.pdf` **ne commence pas** par `%PDF-` — on peut l'identifier.

Patch proposé (concept) :

```javascript
// pseudo-modification dans validateUpload.js
const SIGNATURE_CHECKS = {
    '.pdf': (path) =>
        fs
            .readFile(path, { encoding: 'utf8', flag: 'r' }) /* or read small buffer */
            .then((buf) => buf && buf.startsWith('%PDF-')),
    '.png': (path) => fileTypeFromFile(path).then((ft) => ft && ft.ext === 'png'),
    // .jpg/.jpeg/.gif handled by file-type normally
    '.docx': (path) => /* inspect as zip (node-stream-zip) or file-type detects 'zip' */ false,
};

// after fileTypeFromFile -> if ft undefined and ext in SIGNATURE_CHECKS -> run check and reject if check false
```

Concrètement pour `pdf` : vérifier le header `%PDF-` en lisant les premiers ~32 octets en binaire (pas en `utf8`) :

```javascript
import fs from 'fs/promises';
async function hasPdfHeader(p) {
    const buf = await fs.readFile(p).catch(() => null);
    if (!buf || buf.length < 4) return false;
    return buf.slice(0, 4).toString() === '%PDF';
}
```

2. Rejeter si `file-type` détecte un type différent et si les contrôles de signature ne confirment pas l'extension.

- Déjà présent, mais assurez-vous que la logique couvre le cas `ft === undefined`.

3. Ne jamais faire confiance uniquement à l'extension fournie par l'upload.

- Conserver la whitelist d'extensions mais faire dépendre l'acceptation du fichier d'une correspondance extension↔contenu ou d'une règle spécifique (p.ex. `.txt` autorisé même si non détecté, `.pdf` must match `%PDF-`).

## Priorité moyenne

4. Limiter la taille et le nombre d'entrées dans les archives inspectées

- `inspectArchive` ouvre l'archive et itère sur `entries()` sans limite. Prévenir zip bombs en :
    - limitant le nombre d'entries inspectées (ex : 500)
    - limitant la somme des tailles non compressées si possible
    - limitant la profondeur et la longueur des noms

Code conseillé : après `await zip.entries()` :

```javascript
const names = Object.keys(entries);
if (names.length > 1000) { await zip.close(); fs.unlink(f.path); return reject... }
```

5. Étendre l'inspection des PDFs :

- En plus de rechercher `/JavaScript`, utiliser une bibliothèque dédiée pour détecter objets `/OpenAction` ou autres triggers, ou au minimum limiter taille et refuser s'il y a des patterns suspects.

6. Scanner les fichiers avec un antivirus (ClamAV, VirusTotal API)

- Idéal : appeler un service de scan (ex: clamd) au niveau du tmp avant déplacement.
- Pour une solution cloud, utiliser un service tiers d'analyse de fichiers.

## Priorité basse / Hardening

7. Définir permissions finales sur les fichiers déplacés (chmod 0640) et stocker hors webroot si possible.
8. Renommer / anonymiser les fichiers stockés en utilisant un identifiant (timestamp + uuid) — vous le faites déjà en `moveFilesToUploads`.
9. Rate-limit les uploads, ajouter monitoring/logging d'erreurs et alertes pour tentatives anormales.
10. Blockchain des signatures (hash) si besoin d'audit des fichiers reçus.

## Correctifs pratiques (snippets précis)

1. Exemple d'amélioration pour `validateUpload.js` (PDF header + stricter rule) :

```javascript
import fs from 'fs/promises';
import { fileTypeFromFile } from 'file-type';

async function looksLikePdf(path) {
  try {
    const fd = await fs.open(path, 'r');
    const buf = Buffer.alloc(5);
    await fd.read(buf, 0, 5, 0);
    await fd.close();
    return buf.toString('utf8', 0, 5) === '%PDF-';
  } catch (e) {
    return false;
  }
}

// dans la boucle de validateUpload après fileTypeFromFile
if (ft && ft.ext) {
  const detectedExt = `.${ft.ext.toLowerCase()}`;
  if (detectedExt !== nameExt) {
    // reject
  }
} else {
  // no detection
  // if user supplied .pdf, require header
  if (nameExt === '.pdf') {
     const ok = await looksLikePdf(f.path);
     if (!ok) { // unlink + reject }
  }
  // for png/jpg we can rely on file-type to detect; if undefined, we can also read headers manually
}
```

2. Exemple : rejeter fichiers texte renommés .pdf ou .docx (safety)

- Vous pouvez décider de rejeter si `ft === undefined` **et** declared extension in SIGNATURE_REQUIRED list.

3. `inspectArchive` : ajouter checks sur `Object.keys(entries).length` et la longueur des noms.

4. `moveFilesToUploads` :

- Après déplacement, `await fs.chmod(destPath, 0o640)` (assurez-vous que l'utilisateur de process a ces droits)
- Vérifier `finalPathFor` pour s'assurer que `destPath` n'est pas sous webroot accessible directement.

## Décisions à prendre / politique de sécurité

- Voulez-vous accepter des fichiers "textuels" (csv/txt) renommés ? Si oui, ajoutez `.txt` explicitement et autorisez `ft===undefined` pour `.txt` seulement.
- Pour `.pdf` et images, exigez une signature vérifiable.
- Pour les Office formats (docx, xlsx, pptx), les traiter comme des archives zip et inspecter les entries (déjà fait) : compléter par limites d'entry-count
- Intégrer antivirus si vous recevez des fichiers de sources externes non fiables.

## Exemple de politique simple recommandée (pragmatique)

- Reject si `ALLOWED` ne contient pas l'extension (actuel)
- If `ft` detected and mismatch => reject (actuel)
- Else if `ft` undefined:
    - If extension in [`.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`] => require explicit header match (simple magic-bytes read)
    - If extension in [`.docx`, `.xlsx`, `.pptx`, `.zip`] => try to open with zip and inspect entries (current)
    - If extension in [`.txt`, `.csv`] => allow (optionally verify printable characters and charset)
    - Else => reject by default

## Autres recommandations opérationnelles

- Ajoutez des logs structurés (request id, site id, filename, reason for rejection)
- Ajoutez des métriques (nombre de rejets par raison)
- Considérez l'utilisation d'un job asynchrone pour le scan antivirus (write to tmp, ack minimal, queue scan, mark entry as quarantined until scan ok)

## Résumé & actions immédiates conseillées

1. Modifier `validateUpload.js` pour :
    - traiter le cas `fileTypeFromFile()` retourne `undefined` et rejeter ou exiger une vérification supplémentaire selon l'extension
    - ajouter un check PDF par header `%PDF-` (lecture première tranche d'octets)
2. Ajouter limites dans `inspectArchive.js` (max entries, max name length)
3. Considérer intégration ClamAV (ou équivalent) pour scan deeper
4. Mettre `chmod` sur fichiers finalisés et vérifier qu'ils sont hors webroot

Souhaitez-vous que je :

- A) Propose un patch concret pour `validateUpload.js` (édition du fichier) afin d'implémenter la détection PDF + stricter logic ?
- B) Propose aussi un patch pour `inspectArchive.js` pour limiter entries et nommer raisons de refus ?
- C) Mettre en place un hook minimal ClamAV (ex: appel à `clamscan` ou `clamdscan`) en preuve de concept ?

Je peux implémenter A et B (modifications de code) et exécuter des vérifications locales (lint/lecture). Dites quelle option vous préférez, et je ferai les changements en patch.
