# Politique de sécurité - Puna

## Versions supportées

Seule la dernière version stable de Puna reçoit des correctifs de sécurité.

| Version  | Supportée |
| -------- | --------- |
| latest   | ✅        |
| < latest | ❌        |

---

## Signaler une vulnérabilité

> ⚠️ **Ne pas créer d'issue publique GitHub pour signaler une faille de sécurité.**

Toute divulgation publique avant la publication d'un correctif met en danger les utilisateurs de Puna.

### Méthode recommandée - GitHub Private Vulnerability Reporting

1. Aller sur l'onglet **Security** du dépôt GitHub
2. Cliquer sur **"Report a vulnerability"**
3. Remplir le formulaire avec les informations suivantes :
    - Description claire de la vulnérabilité
    - Étapes pour reproduire
    - Impact potentiel estimé
    - Version de Puna concernée
    - Preuve de concept, si disponible

Le signalement est entièrement privé : seuls les mainteneurs y ont accès jusqu'à la publication du correctif.

### Alternative

Contact direct via les informations de profil GitHub du mainteneur.

---

## Délais de réponse

| Étape                              | Délai    |
| ---------------------------------- | -------- |
| Confirmation de réception          | 48h      |
| Évaluation initiale et priorité    | 7 jours  |
| Correction et publication du patch | 30 jours |

Ces délais sont donnés à titre indicatif. Les vulnérabilités critiques sont traitées en priorité.

---

## Ce qui est dans le périmètre

- Failles d'authentification ou de gestion de session
- Injections (SQL, XSS, path traversal, etc.)
- Contournement du système de permissions (RBAC)
- Vulnérabilités liées à l'upload de fichiers
- Exposition de données sensibles ou de secrets
- Bypass de la protection CSRF

## Ce qui est hors périmètre

- Attaques nécessitant un accès physique au serveur
- Attaques par déni de service (DoS) volumétriques
- Problèmes liés à une configuration incorrecte de l'environnement hôte
- Vulnérabilités dans les dépendances tierces (à signaler directement à leurs mainteneurs)

---

## Reconnaissance

Les chercheurs qui signalent une vulnérabilité de manière responsable sont crédités dans :

- Ce fichier `SECURITY.md` (section Hall of Fame)
- Les notes de version du correctif publié

---

## Hall of Fame

_Aucun signalement pour le moment._

---

## Ressources utiles

- [GitHub Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
