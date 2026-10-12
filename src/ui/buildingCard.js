// The panel that opens when you click a building.
// Phase 1 shows identity and source info; later phases add price, noise,
// parking, transit and construction sections.

const text = (tag, value, className) => {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
};

export class BuildingCard {
  constructor(container, onClose) {
    this.el = container;
    this.onClose = onClose;
  }

  show(buildingId, record) {
    const el = this.el;
    el.replaceChildren();
    const header = document.createElement('div');
    header.className = 'card-header';
    const title = text('h2', record?.address ?? 'Building without a registered address');
    const close = text('button', '×', 'card-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close building details');
    close.onclick = () => this.onClose();
    header.append(title, close);
    el.append(header);

    if (!record) {
      el.append(text('p', `This 3D shape (${buildingId}) has no record in the building list.`, 'card-note'));
    } else {
      if (record.addresses.length > 1) el.append(text('p', `Also: ${record.addresses.slice(1).join(', ')}`, 'card-sub'));
      if (record.addressSv) el.append(text('p', `På svenska: ${record.addressSv}`, 'card-sub'));
      const facts = document.createElement('dl');
      facts.className = 'card-facts';
      const add = (label, value) => { facts.append(text('dt', label), text('dd', value ?? 'Not recorded')); };
      add('Building type', record.use);
      add('Postcode', record.postcode);
      add('Model detail', `LOD${record.lod}${record.buildingParts ? ` · ${record.buildingParts} parts` : ''}`);
      el.append(facts);

      const sources = document.createElement('details');
      sources.className = 'card-sources';
      sources.append(text('summary', 'Sources & IDs'));
      const ids = document.createElement('dl');
      const addId = (label, value) => ids.append(text('dt', label), text('dd', value ?? '—'));
      addId('Model ID (gml:id)', record.sourceIds.gmlId);
      addId('RATU', record.sourceIds.ratu);
      addId('VTJ-PRT', record.sourceIds.vtjPrt);
      addId('Register link', record.registerJoin);
      addId('Geometry', record.geometrySource);
      addId('Tile / feature', `${record.tileContentUri} #${record.tileFeatureId}`);
      sources.append(ids, text('p', 'City of Helsinki 3D model and building register, CC BY 4.0.', 'card-note'));
      el.append(sources);
    }
    el.hidden = false;
  }

  hide() { this.el.hidden = true; }
}
