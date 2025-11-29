# Analyse - API /send : validation et sécurité des fichiers

**Date :** 30 novembre 2025
**Auteur :** Analyse automatique
**Statut :** Mis à jour après implémentation des protections

---

## 📋 Récapitulatif des protections actuellement en place

### Pipeline complet de validation des uploads

La route API `/send/:code` utilise cette chaîne de middlewares (ordre d'exécution) :

1. **`authApiKeyAccess`** - Authentifie le site et le formulaire via JWT
2. **`multipartUpload`** - Multer écrit les fichiers en `storage/tmp/` (max 20 MB par fichier)
3. **`validateUpload`** - ✅ **RENFORCÉ** - Vérifie extensions ET signatures binaires
4. **`inspectArchive`** - ✅ **RENFORCÉ** - Inspection approfondie des archives
5. **`moveFilesToUploads`** - Déplace vers storage final
6. **`updateFormFileKeys`** - Met à jour file_keys du formulaire
7. **`sanitizeRequestBody`** - Sanitise le body reçu
8. **`updateFormTemplate`** - Mise à jour template/columns si nécessaire
9. **`sendHandler`** - Persiste la payload dans Inbox

---

## ✅ Protections implémentées (État actuel)

### 1. **validateUpload.js** - Validation stricte par signatures binaires

#### ✅ Ce qui est contrôlé :

**Extensions autorisées :**

- Images : `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- Documents : `.pdf`, `.doc`, `.docx`, `.odt`
- Tableurs : `.xls`, `.xlsx`
- Texte : `.txt`, `.csv`

**Vérifications par magic bytes (signatures binaires) :**

| Format      | Signature vérifiée         | Détection                  |
| ----------- | -------------------------- | -------------------------- |
| **PDF**     | `%PDF` (4 premiers octets) | ✅ Header obligatoire      |
| **PNG**     | `89 50 4E 47 0D 0A 1A 0A`  | ✅ Signature 8 octets      |
| **JPEG**    | `FF D8 FF`                 | ✅ Signature 3 octets      |
| **GIF**     | `GIF87a` ou `GIF89a`       | ✅ Signature 6 octets      |
| **WEBP**    | `RIFF....WEBP`             | ✅ Signature RIFF+WEBP     |
| **TXT/CSV** | Aucune (texte libre)       | ✅ Autorisé sans signature |

#### ✅ Résultat :

- ❌ **Bloque** : Fichier `.sh` renommé en `.pdf` (pas de signature `%PDF`)
- ❌ **Bloque** : Fichier `.exe` renommé en `.png` (pas de signature PNG)
- ❌ **Bloque** : Tout fichier dont la signature ne correspond pas à son extension
- ✅ **Accepte** : Fichiers légitimes avec signatures valides

---

### 2. **inspectArchive.js** - Protection contre archives malveillantes

#### ✅ Formats inspectés (archives ZIP déguisées) :

- `.docx`, `.xlsx`, `.pptx` (Microsoft Office)
- `.odt` (OpenOffice/LibreOffice)
- `.zip` (si autorisé)

#### ✅ Protections implémentées :

**🛡️ Protection 1 : Limite nombre d'entrées**

```javascript
MAX_ENTRIES = 1000 fichiers maximum
```

- Bloque archives avec 10 000+ fichiers
- Empêche épuisement CPU/RAM

**🛡️ Protection 2 : Limite taille décompressée**

```javascript
MAX_UNCOMPRESSED_SIZE = 250 MB
```

- Somme totale des tailles non compressées
- Bloque zip bombs (42 KB → 4.5 GB)

**🛡️ Protection 3 : Limite longueur noms de fichiers**

```javascript
MAX_NAME_LENGTH = 255 caractères
```

- Bloque noms suspects de milliers de caractères
- Conforme aux limites filesystem

**🛡️ Protection 4 : Détection path traversal**

```javascript
Rejette: ('../', '/', '\\..');
```

- Empêche extraction malveillante hors répertoire
- Bloque tentatives d'écrasement fichiers système

**🛡️ Protection 5 : Ratio de compression maximum**

```javascript
MAX_COMPRESSION_RATIO = 100:1
```

- Détecte zip bombs sophistiquées
- Fichier 10 KB → 1 GB = rejeté

**🛡️ Protection 6 : Détection macros VBA**

```javascript
Rejette : vbaProject.bin, fichiers VBA
```

- Bloque documents Office avec macros malveillantes

**🛡️ Protection 7 : Détection exécutables**

```javascript
Rejette : .exe, .dll, .bat, .sh, .cmd, .scr, .com, .js
```

- Bloque exécutables cachés dans archives

**🛡️ Protection 8 : Détection JavaScript dans PDF**

```javascript
Scan contenu : "/JavaScript"
```

- Bloque PDFs avec scripts embarqués

#### ✅ Résultat :

| Type d'attaque              | Protection       | Statut    |
| --------------------------- | ---------------- | --------- |
| Zip bomb (42 KB → 4.5 GB)   | Ratio 100:1      | ✅ Bloqué |
| Archive 10 000 fichiers     | Max 1000 entries | ✅ Bloqué |
| `.docx` avec macro          | Détection VBA    | ✅ Bloqué |
| Archive avec `.exe` dedans  | Scan extensions  | ✅ Bloqué |
| Nom fichier 5000 chars      | Max 255 chars    | ✅ Bloqué |
| Path `../../etc/passwd`     | Path traversal   | ✅ Bloqué |
| Archive 300 MB décompressée | Max 250 MB       | ✅ Bloqué |

---

## 🔒 Niveau de sécurité actuel

### ✅ Ce qui est protégé :

1. ✅ **Faux fichiers** (renommage d'extension) → Bloqué par signatures binaires
2. ✅ **Zip bombs** → Bloqué par ratio compression + limite taille
3. ✅ **Archives massives** → Bloqué par limite entrées
4. ✅ **Macros malveillantes** → Bloqué dans Office documents
5. ✅ **Exécutables cachés** → Bloqué dans archives
6. ✅ **Path traversal** → Bloqué
7. ✅ **PDFs avec JavaScript** → Bloqué

### ⚠️ Ce qui N'est PAS encore protégé :

1. ❌ **Virus/Malwares** avec signature non détectée par magic bytes
2. ❌ **Exploits 0-day** dans documents légitimes
3. ❌ **Payloads cachés** (steganographie dans images)
4. ❌ **Documents corrompus** volontairement pour exploiter parsers
5. ❌ **Ransomwares polymorphiques** qui changent leur signature

**→ Solution recommandée : Intégration ClamAV (antivirus)**

---

## 🚀 Protection supplémentaire recommandée : Intégration ClamAV

### Pourquoi ajouter un antivirus ?

Les protections actuelles (magic bytes + inspection archives) sont **excellentes** mais limitées :

| Protection actuelle  | Ce qu'elle détecte      | Ce qu'elle ne détecte PAS              |
| -------------------- | ----------------------- | -------------------------------------- |
| Magic bytes          | Faux fichiers renommés  | Vrais PDFs avec exploit CVE-2023-XXXX  |
| Inspection archives  | Macros VBA, exécutables | Virus polymorphique dans `.docx` légit |
| Ratio compression    | Zip bombs classiques    | Malware caché par steganographie       |
| Extensions whitelist | Fichiers non autorisés  | Ransomware dans vrai `.png`            |

**→ ClamAV comble ces failles en scannant le contenu réel avec une base de signatures mise à jour quotidiennement.**

---

## 🦠 Qu'est-ce que ClamAV ?

**ClamAV** (Clam AntiVirus) est un antivirus open-source qui :

- ✅ Détecte **millions de signatures** de virus/malwares/trojans
- ✅ Base mise à jour **quotidiennement** automatiquement
- ✅ Gratuit et open-source (GPLv2)
- ✅ Faible empreinte mémoire (~500 MB RAM pour le daemon)
- ✅ Intégration facile avec Node.js

**Détection :**

- Virus, trojans, ransomwares
- Exploits CVE connus dans PDF/Office
- Backdoors, rootkits
- Scripts malveillants obfusqués
- Payloads cachés (steganographie)

---

## 📐 Architecture proposée

### Pipeline complet avec ClamAV

```
Upload (HTTP POST)
    ↓
1. authApiKeyAccess       ← Authentification JWT
    ↓
2. multipartUpload        ← Multer → storage/tmp/
    ↓
3. validateUpload         ← Magic bytes (PDF/PNG/JPEG/GIF/WEBP)
    ↓
4. inspectArchive         ← Zip bombs, macros, exécutables
    ↓
5. scanVirus (ClamAV)     ← 🆕 SCAN ANTIVIRUS
    ↓                        ├─ Virus détecté ? → Reject + Delete
    ↓                        └─ Clean ? → Continue
6. moveFilesToUploads     ← Déplacement vers storage final
    ↓
7. updateFormFileKeys     ← Mise à jour BDD
    ↓
8. sanitizeRequestBody    ← Sanitisation payload
    ↓
9. updateFormTemplate     ← Template/columns
    ↓
10. sendHandler           ← Persistence Inbox
```

---

## 🔧 Installation ClamAV

### Option 1 : Installation native (Linux/macOS)

#### Ubuntu/Debian

```bash
# Installer ClamAV
sudo apt-get update
sudo apt-get install clamav clamav-daemon

# Mettre à jour la base de signatures
sudo freshclam

# Démarrer le daemon
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon

# Vérifier le statut
sudo systemctl status clamav-daemon
```

#### macOS (Homebrew)

```bash
# Installer ClamAV
brew install clamav

# Configuration initiale
cd /usr/local/etc/clamav
cp freshclam.conf.sample freshclam.conf
cp clamd.conf.sample clamd.conf

# Éditer clamd.conf : commenter la ligne "Example"
sed -i '' 's/^Example/#Example/' clamd.conf
sed -i '' 's/^Example/#Example/' freshclam.conf

# Mettre à jour signatures
freshclam

# Démarrer le daemon
brew services start clamav
```

### Option 2 : Docker (recommandé pour dev/test)

```yaml
# docker-compose.yml
services:
    clamav:
        image: clamav/clamav:latest
        container_name: puna-clamav
        ports:
            - '3310:3310'
        volumes:
            - clamav-data:/var/lib/clamav
        environment:
            - CLAMAV_NO_FRESHCLAM=false
        restart: unless-stopped

volumes:
    clamav-data:
```

```bash
# Démarrer ClamAV
docker-compose up -d clamav

# Vérifier les logs (première mise à jour prend ~5 min)
docker-compose logs -f clamav
```

---

## 💻 Implémentation Node.js

### 1. Installer la bibliothèque Node.js

```bash
npm install clamscan
```

### 2. Créer le middleware `src/api/v1/middlewares/scanVirus.js`

```javascript
import fs from 'fs/promises';
import NodeClam from 'clamscan';

let clamScan = null;
let clamAvailable = false;

/**
 * Initialiser ClamAV au démarrage de l'application
 * À appeler dans server.js ou app.js
 */
export async function initClamAV() {
    try {
        clamScan = await new NodeClam().init({
            clamdscan: {
                socket: process.env.CLAMAV_SOCKET || '/var/run/clamav/clamd.sock', // Linux
                // socket: '/usr/local/var/run/clamav/clamd.sock', // macOS
                host: process.env.CLAMAV_HOST || '127.0.0.1',
                port: parseInt(process.env.CLAMAV_PORT, 10) || 3310,
                timeout: 60000, // 60 secondes
                local_fallback: false, // Ne pas fallback sur clamscan CLI (lent)
            },
            preference: 'clamdscan', // Utiliser le daemon (plus rapide)
        });

        // Tester la connexion
        const version = await clamScan.getVersion();
        console.log(`✅ ClamAV initialized: ${version}`);
        clamAvailable = true;
    } catch (err) {
        console.error('❌ ClamAV initialization failed:', err.message);
        console.warn('⚠️  Upload scanning will continue WITHOUT antivirus protection');
        clamAvailable = false;
    }
}

/**
 * Middleware de scan antivirus
 * À placer après inspectArchive et avant moveFilesToUploads
 */
export default async function scanVirus(req, res, next) {
    try {
        // Si ClamAV n'est pas disponible, continuer en mode dégradé
        if (!clamAvailable || !clamScan) {
            console.warn('⚠️  ClamAV not available, skipping virus scan');
            return next();
        }

        const files = req.files || [];
        if (files.length === 0) {
            return next();
        }

        // Scanner chaque fichier
        for (const f of files) {
            try {
                const { isInfected, viruses } = await clamScan.scanFile(f.path);

                if (isInfected) {
                    // Log l'incident (important pour audit)
                    console.error(
                        `🦠 VIRUS DETECTED: ${viruses.join(', ')} in file ${f.originalname} from ${req.site?.domain || 'unknown'}`
                    );

                    // Supprimer TOUS les fichiers de la requête
                    for (const toDel of files) {
                        try {
                            await fs.unlink(toDel.path);
                        } catch (e) {
                            console.error('Error deleting infected file:', e);
                        }
                    }

                    return res.status(400).json({
                        success: false,
                        error: `File rejected: contains malicious content (${viruses.join(', ')})`,
                    });
                }
            } catch (scanErr) {
                // Erreur de scan (timeout, fichier corrompu, etc.)
                console.error(`Virus scan error for ${f.originalname}:`, scanErr.message);

                // POLITIQUE DE SÉCURITÉ : En cas d'erreur de scan, REJETER par défaut
                // (Vous pouvez changer en "continuer" si vous acceptez le risque)
                for (const toDel of files) {
                    try {
                        await fs.unlink(toDel.path);
                    } catch (e) {
                        console.error('Error deleting file after scan error:', e);
                    }
                }

                return res.status(500).json({
                    success: false,
                    error: 'File could not be scanned for viruses',
                });
            }
        }

        // Tous les fichiers sont clean
        return next();
    } catch (err) {
        console.error('Virus scan middleware error:', err);

        // Cleanup des fichiers
        const files = req.files || [];
        for (const toDel of files) {
            try {
                await fs.unlink(toDel.path);
            } catch (e) {
                console.error(e);
            }
        }

        return res.status(500).json({
            success: false,
            error: 'Virus scanning failed',
        });
    }
}
```

### 3. Initialiser ClamAV dans `server.js` ou `app.js`

```javascript
import express from 'express';
import { initClamAV } from './api/v1/middlewares/scanVirus.js';

const app = express();

// ... autres middlewares ...

// Initialiser ClamAV au démarrage
await initClamAV();

// ... routes ...

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
```

### 4. Intégrer dans `src/api/v1/default.api.js`

```javascript
import express from 'express';
import { sendHandler } from './handlers/default.handler.js';
import { authApiKeyAccess } from './middlewares/authApiKeyAccess.js';
import inspectArchive from './middlewares/inspectArchive.js';
import moveFilesToUploads from './middlewares/moveFilesToUploads.js';
import { multipartUpload } from './middlewares/multipartUpload.js';
import updateFormFileKeys from './middlewares/updateFormFileKeys.js';
import { updateFormTemplate } from './middlewares/updateFormTemplate.js';
import validateUpload from './middlewares/validateUpload.js';
import { sanitizeRequestBody } from './validators/sanitizeRequest.js';
import scanVirus from './middlewares/scanVirus.js'; // ← NOUVEAU

const router = express.Router();

router.post(
    '/send/:code',
    authApiKeyAccess,
    multipartUpload,
    validateUpload,
    inspectArchive,
    scanVirus, // ← NOUVEAU : Scan antivirus après inspectArchive
    moveFilesToUploads, // ← Seulement si clean
    updateFormFileKeys,
    sanitizeRequestBody,
    updateFormTemplate,
    sendHandler
);

export default router;
```

### 5. Variables d'environnement (`.env`)

```bash
# ClamAV Configuration
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
CLAMAV_SOCKET=/var/run/clamav/clamd.sock  # Linux
# CLAMAV_SOCKET=/usr/local/var/run/clamav/clamd.sock  # macOS
```

---

## ⚙️ Configuration et tuning

### Performances ClamAV

**Daemon ClamAV (`clamd.conf`) :**

```conf
# Limites recommandées
MaxThreads 12              # Threads parallèles (CPU cores)
MaxScanSize 300M           # Taille max fichier scanné (doit être > votre MAX_UPLOAD_SIZE)
MaxFileSize 100M           # Taille max fichier individuel
StreamMaxLength 300M       # Taille max stream
MaxRecursion 16            # Profondeur scan archives
MaxFiles 10000             # Nombre max fichiers dans archive
```

**Temps de scan typiques :**

- Fichier 1 MB : ~0.1-0.5 secondes
- Fichier 10 MB : ~0.5-2 secondes
- Fichier 50 MB : ~2-5 secondes
- Archive Office : ~1-3 secondes

### Mode dégradé (ClamAV indisponible)

Le middleware est conçu pour **continuer de fonctionner** si ClamAV n'est pas disponible :

```javascript
if (!clamAvailable || !clamScan) {
    console.warn('⚠️  ClamAV not available, skipping virus scan');
    return next(); // Continue sans scan
}
```

**⚠️ IMPORTANT :** En production, vous devez :

- Monitorer la disponibilité de ClamAV
- Recevoir des alertes si le service est down
- Décider si vous bloquez les uploads quand ClamAV est HS

---

## 📊 Monitoring et logs

### Logs recommandés

```javascript
// Dans scanVirus.js - Ajouter logging structuré

import winston from 'winston'; // ou votre logger

// Log des scans réussis
logger.info('Virus scan completed', {
    filename: f.originalname,
    size: f.size,
    site: req.site?.domain,
    scanDuration: Date.now() - startTime,
    result: 'clean',
});

// Log des détections
logger.error('VIRUS DETECTED', {
    filename: f.originalname,
    size: f.size,
    site: req.site?.domain,
    viruses: viruses,
    ip: req.ip,
    timestamp: new Date().toISOString(),
});
```

### Métriques à tracker

- Nombre de scans par jour
- Nombre de virus détectés
- Temps moyen de scan
- Taux d'erreur de scan
- Disponibilité du daemon ClamAV

---

## 🔒 Résultat final avec ClamAV

### Protection complète multicouche

| Couche                     | Protection                     | Statut           |
| -------------------------- | ------------------------------ | ---------------- |
| **1. Extension whitelist** | Bloque types non autorisés     | ✅ Actif         |
| **2. Magic bytes**         | Détecte faux fichiers renommés | ✅ Actif         |
| **3. Archive inspection**  | Zip bombs, macros, exécutables | ✅ Actif         |
| **4. ClamAV**              | Virus, malwares, exploits CVE  | 🆕 À implémenter |

### Exemples de détection

| Menace                               | Sans ClamAV             | Avec ClamAV   |
| ------------------------------------ | ----------------------- | ------------- |
| `script.sh` → `doc.pdf`              | ✅ Bloqué (magic bytes) | ✅ Bloqué     |
| Vrai PDF avec exploit CVE-2023-1234  | ❌ Passe                | ✅ **Bloqué** |
| Ransomware dans image PNG légitime   | ❌ Passe                | ✅ **Bloqué** |
| Trojan caché dans `.docx` sans macro | ❌ Passe                | ✅ **Bloqué** |
| Zip bomb 42 KB → 4 GB                | ✅ Bloqué (ratio)       | ✅ Bloqué     |
| Macro VBA dans Excel                 | ✅ Bloqué (inspection)  | ✅ Bloqué     |

---

## 🚦 Recommandations de mise en œuvre

### Phase 1 : Test en environnement de développement

1. Installer ClamAV (Docker recommandé)
2. Implémenter `scanVirus.js` avec mode dégradé
3. Tester avec fichiers propres et EICAR test file
4. Mesurer impact sur performances

### Phase 2 : Déploiement staging

1. Déployer sur environnement de staging
2. Activer logs détaillés
3. Tester charge (uploads simultanés)
4. Ajuster `MaxThreads` selon charge

### Phase 3 : Production

1. Monitorer disponibilité ClamAV (healthcheck)
2. Alertes si daemon down
3. Logs centralisés (ELK, Datadog, etc.)
4. Backups réguliers base de signatures

### Fichier de test EICAR

Pour tester ClamAV, utilisez le fichier test standard EICAR (non dangereux) :

```bash
# Créer fichier test EICAR
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.txt

# Uploader via votre API → doit être rejeté avec message "Eicar-Signature"
```

---

## 💰 Coûts et alternatives

### ClamAV (Open Source)

- ✅ **Gratuit**
- ✅ Base de signatures communautaire
- ✅ Auto-hébergé
- ⚠️ ~500 MB RAM
- ⚠️ Taux de détection ~85-90%

### Alternatives cloud (payantes)

#### VirusTotal API

```javascript
// Upload vers VirusTotal pour scan par 70+ antivirus
const FormData = require('form-data');
const form = new FormData();
form.append('file', fs.createReadStream(filePath));

const response = await fetch('https://www.virustotal.com/api/v3/files', {
    method: 'POST',
    headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY },
    body: form,
});
```

- ✅ 70+ moteurs antivirus
- ✅ Taux de détection ~99%
- ❌ Payant ($$$)
- ❌ Upload fichiers vers service tiers (confidentialité)

#### MetaDefender Cloud

- ✅ 30+ moteurs
- ❌ Payant
- ❌ Latence réseau

**→ Recommandation : ClamAV suffit pour la plupart des cas d'usage**

---

## 📝 Checklist d'implémentation

- [ ] Installer ClamAV (natif ou Docker)
- [ ] Démarrer daemon et vérifier disponibilité
- [ ] Mettre à jour base de signatures (`freshclam`)
- [ ] Installer `npm install clamscan`
- [ ] Créer `src/api/v1/middlewares/scanVirus.js`
- [ ] Ajouter `initClamAV()` dans `server.js`
- [ ] Intégrer middleware dans `default.api.js`
- [ ] Configurer variables d'environnement
- [ ] Tester avec fichier EICAR
- [ ] Configurer logs et monitoring
- [ ] Tester performances sous charge
- [ ] Déployer en production
- [ ] Configurer alertes si daemon down

---

## 🎯 Conclusion

L'intégration de ClamAV complète votre stratégie de défense en profondeur :

1. ✅ **Magic bytes** → Bloque faux fichiers
2. ✅ **Archive inspection** → Bloque zip bombs et macros
3. 🆕 **ClamAV** → Bloque virus/malwares réels

**Niveau de sécurité final : 🔒🔒🔒🔒 Excellent**

Pour une sécurité maximale en environnement critique (santé, finance), considérez aussi :

- Sandboxing (analyse comportementale)
- Quarantaine temporaire avec validation manuelle
- Scanner cloud multi-moteurs (VirusTotal)

**Contact pour support :** Si besoin d'aide pour l'implémentation, créez une issue sur le repo ou contactez l'équipe DevOps.
