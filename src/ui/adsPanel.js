import {legendKeys} from './legend.js';
import {t, tn, locale} from './i18n.js';

// Ads view legend (Ton, 16 Oct 2026): what the amber means, how many ads and
// addresses, and when the ads were read. An ad is linked to every building at its
// address (sheds and courtyard wings too), so the count is by address.
export function adsLegend(container,listings,color){
 if(!listings){container.replaceChildren();container.classList.remove('is-gradient','is-keys');container.textContent=t('Rental ads are still loading or unavailable.');return;}
 const linked=listings.ads.filter(a=>a.buildingIds.length);
 const addresses=new Set(linked.map(a=>a.street+'|'+a.postcode)).size;
 const when=new Date(listings.updatedAt).toLocaleString(locale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 legendKeys(container,{items:[{color,text:t('Building with a rental ad now'),square:true}],
  note:[t('{ads} at {addresses}',{ads:tn(linked.length,'{n} ad','{n} ads'),addresses:tn(addresses,'{n} address','{n} addresses')}),t('Oikotie, {time}',{time:when})].join(' · ')});
}
