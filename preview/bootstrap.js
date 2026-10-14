// This file is only served by the loopback sandbox. No production page loads it.
const previewRole=sessionStorage.getItem('biz-preview-role')==='superuser'?'superuser':'reader';
localStorage.setItem('omnip-bo-gtoken',JSON.stringify({token:'fixture-'+previewRole}));
