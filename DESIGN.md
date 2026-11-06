# Roadmap XP : design

## Concept : Le Sentier
La route 1 → 36 est un sentier jalonné de bornes. Chaque quête est une borne ; la prochaine porte la **torche**, une lueur or qui vacille. Cocher « Done » fait avancer la torche d'une borne. Tout l'écran sert cette image : on sait où on est, ce qui vient, ce qui est fait.

## Direction artistique
- **Matière** : pierre sombre de donjon (ardoise bleutée, jamais noir pur), lueur chaude de torche.
- **Couleurs** (jetons dans `src/assets/base.css`) : fond `#0f1116`, surfaces `#171a21` / `#1e222b`, texte `#e8e6df` (ivoire froid), atténué `#a3a7b4`, torche `#f0b44c`, paliers héroïque `#79aee0`, épique `#b293ea`, légendaire `#f0b44c`. Thème clair « parchemin » en AA pour ceux dont le système est en clair.
- **Typographie** : titres en Cinzel 700 (capitales gravées, rappel des inscriptions de donjon), texte en IBM Plex Sans 400/500/600, chiffres et niveaux en IBM Plex Mono 500. Auto-hébergées en woff2 (latin). Échelle : 13 / 15 / 17 / 21 / 28 / 40 / 56 px.
- **Grille** : 12 colonnes, gouttière 24 px, contenu max 72 rem ; l'app tient dans une colonne de 46 rem pour la lecture en alt-tab.
- **Forme** : rayons 10 px (cartes) et 999 px (pastilles) ; une seule carte à bordure dorée par écran, celle de la prochaine quête.

## Motion
- **Signature** : la torche qui vacille sur la borne active (repos), et qui glisse vers la borne suivante quand on coche « Fait » (transform, 900 ms, `cubic-bezier(0.4, 0, 0.2, 1)`, courbe régulière pour que le trajet se voie). Durée choisie par Camil le 06/11/2026 : à 450 ms le glissement était trop rapide à l'œil. Elle dépasse volontairement le budget de 300 ms des retours d'interaction. Sur « Undo », la torche s'éteint, recule éteinte, puis se rallume sur la borne d'avant (même durée).
- **Arrivée** : sur l'accueil, le sentier se trace de gauche à droite (stroke-dashoffset), puis les bornes apparaissent en décalé (40 ms), puis la carte quête monte en fondu ; total ≤ 1,1 s.
- **Transitions d'écran** : View Transitions (document et SPA), sortie ≤ 250 ms, entrée ≤ 450 ms ; la carte quête est l'élément partagé entre la route et l'écran principal.
- **Micro-interactions** : boutons (soulèvement 1 px, ombre, remplissage), liens de navigation (soulignement qui se dessine), cases à cocher (coche tracée), lignes de route (fond qui glisse).
- **Mouvement réduit** : fondus courts seulement, torche fixe.
- **Sans objet, décidé** : Lenis et GSAP ne sont pas utilisés. C'est un outil : défilement natif, et l'API Web Animations suffit pour les quelques mouvements, sans bibliothèque de 30 ko. Pas de séquence ScrollTrigger : rien à raconter au défilement, l'accueil tient en un écran et demi. Pas de bande défilante. Pas de texte cinétique.

## Décisions
- **Mode sombre** : sombre par défaut (`color-scheme: dark light`), thème clair complet en AA si le système est en clair. Raison : le joueur arrive d'un jeu plein écran sombre.
- **Langue** : anglais seulement (décision de l'éditeur, 05/11/2026). Pas de typographie française. Raccourcis D (Done), S (Skip), U (Undo), R (route).
- **Mesure d'audience** : aucune.
- **Impression** : `@media print` masque la navigation, la torche et les boutons.
- **Hors ligne** : pas de service worker.
- **Élément partagé** : oui, la carte quête (route → écran principal).
- **Loader** : non. Un outil se doit d'être immédiat.
- **Pile** : Cloudflare Pages + Pages Functions + D1, HTML statique généré par `build.mjs` (contenu présent sans JS pour l'accueil, le guide et les pages légales), JavaScript sans framework pour l'app.

## Exceptions Impeccable
Aucune pour l'instant.

## Carte « L'Ascension » (06/11/2026)

- **Idée** : la route 1 → 36 en un seul paysage vu de côté. L'axe x suit les niveaux (héroïque 1-19, épique 20-29, légendaire 30-36), l'axe y l'altitude : le port au niveau de la mer, les sommets héroïques (Storm Horns, niveau 19), la coupe de l'Underdark pour l'épique, puis la montée vers le sommet légendaire (niveau 36). Choisie par Camil après un concours de trois concepts notés par deux juges (L'Ascension 7,5, la route encrée 7,0, la carte du ciel 6,4).
- **Code** : `map.mjs` génère au build un SVG statique (aucun script pour dessiner) ; `src/map-glyphs/` contient les 11 symboles de zones (viewBox 40, classes `gi` `gf` `gd` `ga`, au plus 7 formes, aucune couleur en dur) ; `src/assets/map.js` déplace seulement la torche (variables `--tx`, `--ty`, `--wx` sur la figure).
- **Données** : les zones et leurs niveaux sont tirés de la route (groupes du parcours principal). Korthos n'y figure pas : la route d'un perso réincarné commence au port.
- **Vues** : une image sur ordinateur ; quatre panneaux recadrés (héroïque 1-9, héroïque 9-19, épique, légendaire) sous 45rem, l'accueil n'affichant que celui de la torche ; la liste des zones en texte dans un dépliant.
- **Thèmes** : jetons `--sky-*`, `--ridge-*`, `--ground`, `--cave`, `--sea`, `--trail`, `--glyph-*`, `--snow` redéfinis en clair ; la lueur de la torche devient un anneau sur parchemin.
- **Mouvement** : la torche et le sentier allumé suivent en 900 ms (même durée que la torche du sentier) ; flamme qui vacille ; rien sous `prefers-reduced-motion`.
- **Droit** : paysage inventé, symboles génériques ; rien n'est repris des cartes, logos ou visuels du jeu (mentionné dans les mentions légales).
- **Performance** : pas de motif SVG (`<pattern>`) sur le sol : la trame hachurée faisait passer le blocage mobile de l'accueil d'environ 70 ms à plus de 800 ms (mesure Lighthouse avant/après, 06/11/2026).
