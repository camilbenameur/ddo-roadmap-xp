// Fondus entre pages : le navigateur peut annuler une transition (retour arrière, onglet masqué).
// Sans ces gestionnaires, l'annulation finit en erreur dans la console.
const quiet = vt => { if (vt) { vt.ready.catch(() => {}); vt.finished.catch(() => {}); vt.updateCallbackDone.catch(() => {}); } };
addEventListener("pageswap", e => quiet(e.viewTransition));
addEventListener("pagereveal", e => quiet(e.viewTransition));
