// Wird synchron im <head> geladen, damit beim Seitenaufbau kein Farbblitz entsteht.
try { var t = localStorage.getItem('apex-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
