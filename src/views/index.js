// The map views behind the tab bar, one file each (Ton, 17 Oct 2026).
//
// Every view has the same shape:
//   uses       the data layers it shows; when one of them loads, show runs again.
//   show(ctx)  puts the view on screen: building colours, legend, panels. It is also
//              called again for the open view when a layer it uses finishes loading,
//              so it must work any number of times in a row.
//   hide(ctx)  takes away what only this view shows (optional). Called once, when
//              another view opens.
// ctx: {state, layers, legend, $, fade, setView}. layers holds the data layers, null
// until loaded; legend is the panel above the tab bar, emptied and hidden before show.
import {overview} from './overview.js';
import {price} from './price.js';
import {noise} from './noise.js';
import {parking} from './parking.js';
import {ads} from './ads.js';
import {sun} from './sun.js';

// Keys as used in the tab buttons (data-view) and the link (?view=).
export const VIEWS = {overview, sale: price, noise, parking, ads, sun};
