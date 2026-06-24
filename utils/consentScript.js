const CONSENT_STORAGE_KEY = 'np_cookie_consent';

/**
 * Wrap tracking HTML so it loads only after cookie consent (or if already stored).
 */
function buildDeferredLoader(html) {
  if (!html || !String(html).trim()) return '';
  const safe = String(html).replace(/<\/template/gi, '<\\/template');
  return [
    '<template id="np-deferred-tracking">',
    safe,
    '</template>',
    `<script>(function(){
      var key='${CONSENT_STORAGE_KEY}';
      function hasConsent(){
        var raw=localStorage.getItem(key);
        if(!raw)return false;
        var ts=Number(raw);
        return !Number.isNaN(ts);
      }
      function activate(){
        var tpl=document.getElementById('np-deferred-tracking');
        if(!tpl)return;
        var host=document.createElement('div');
        host.innerHTML=tpl.innerHTML;
        Array.from(host.children).forEach(function(node){
          if(node.tagName==='SCRIPT'){
            var s=document.createElement('script');
            Array.from(node.attributes).forEach(function(attr){s.setAttribute(attr.name,attr.value);});
            s.textContent=node.textContent;
            document.head.appendChild(s);
          } else {
            document.head.appendChild(node);
          }
        });
        tpl.remove();
      }
      if(hasConsent())activate();
      else window.addEventListener('np:consent',activate,{once:true});
    })();</script>`
  ].join('\n');
}

module.exports = {
  CONSENT_STORAGE_KEY,
  buildDeferredLoader
};
