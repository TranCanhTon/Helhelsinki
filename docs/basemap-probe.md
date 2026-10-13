# Helsinki basemap source probe

Saved official WFS probes from 12 October 2026. Size estimates use samples, not full downloads.

Recommendation: use YLRE_Katualue_alue citywide for road hierarchy and actual street outlines, plus YLRE_Katu_ja_viherosat_ajorata_alue in the central detail area for carriageways. Avoid the roughly 497 MB all-parts layer. Use guide areas and lines for water, forest, squares, bridges, rail, light rail and piers. Exclude planned, unbuilt and underground features.

## avoindata:Maavesi_maa_alueet_yleistetty

327 records; estimated 4.5 MB; Polygon.

Fields:

- tietopalvelu_id (int)
- tyyppi (string)
- datanomistaja (string)
- paivitetty_tietopalveluun (date)
- geom (Geometry)

Type and class values (value: count):

- **tyyppi**: Maa_alue_yleistetty: 327

## avoindata:Opaskartta_alue

15,311 records; estimated 13.1 MB; Polygon/MultiPolygon.

Fields:

- id (int)
- tyyppi (string)
- luokka (string)
- kunta (string)
- voimassaolo (string)
- luontipvm (date)
- muokkauspvm (date)
- datanomistaja (string)
- paivitetty_tietopalveluun (date)
- geom (Geometry)

Type and class values (value: count):

- **tyyppi**: rakennuskortteli: 7128; maankäyttöalue: 5237; rakennus: 1382; tie: 1246; vesistö: 299; metro: 19
- **luokka**: kerrostalokortteli: 3431; metsä: 3078; pientalokortteli: 3038; aukio: 1396; julkinen rakennus: 1382; asuntokatu: 808; pelto: 763; teollisuuskortteli: 659; silta: 241; lampi: 111; kokoojatie: 83; allas: 68; meri: 67; moottoritie: 59; päätie: 55; joki: 53; metroasema: 19
- **voimassaolo**: voimassa: 15311

## avoindata:Opaskartta_muuviiva

2,245 records; estimated 1.3 MB; LineString.

Fields:

- id (int)
- tyyppi (string)
- luokka (string)
- kunta (string)
- voimassaolo (string)
- luontipvm (date)
- muokkauspvm (date)
- datanomistaja (string)
- paivitetty_tietopalveluun (date)
- geom (Geometry)

Type and class values (value: count):

- **tyyppi**: tie: 1249; muu: 762; rautatie: 129; metro: 90; pikaraitiotie: 15
- **luokka**: suunnitteilla oleva tie: 1152; rantalaituri: 724; rautatie: 112; ajoeste tai -kielto: 70; metrorata: 44; voimajohto: 38; tekstin kehys: 34; metrorata maan alla: 27; tunneli: 25; pikaraitiotie: 12; pikaraitiotie maan alla: 3; suunnitteilla oleva tunneli: 2; rautatie maan alla: 1; rautatie suunnitteilla: 1
- **voimassaolo**: voimassa: 2243; suunnitteilla: 2

## avoindata:Puurekisteri_piste

67,244 records; estimated 29.2 MB; Point.

Fields:

- id (int)
- tunnus (string)
- kadunnimi (string)
- puistonnimi (string)
- paatyyppi (string)
- suomenknimi (string)
- suku (string)
- laji (string)
- kokoluokka (string)
- istutusvuosi (int)
- datanomistaja (string)
- paivitetty_tietopalveluun (date)
- geom (Geometry)

Type and class values (value: count):

- **paatyyppi**: Puisto: 41117; Katu: 25801; Täydennys: 325; Onnettomuus: 1
- **laji**: platyphyllos: 496; x vulgaris: 11780; pendula: 6842; hybrida: 273; platanoides: 7345; glutinosa: 2137; glabra: 3213; menziesii: 211; alba: 303; robur: 2338; abies: 1027; sylvestris: 3408; papyrifera: 32; aucuparia: 1618; intermedia: 1067; sargentii: 669; incana: 227; sp.: 9425; laevis: 287; hippocastanum: 282; excelsior: 396; pseudoplatanus: 27; deltoides: 6; tremula: 1653; canescens: 12; occidentalis: 129; cembra: 224; cordata: 618; x rubens: 261; avellana: 73; sylvatica: 75; nigra: 39; mugo: 62; padus: 255; Rasumowskiana: 16; Hoersholmiensis: 1; pallasiana: 1; laurifolia: 27; grayana: 25; maackii: 178; negundo: 111; sibirica: 111; pubescens: 855; Purpurea-Ryhmä: 130; baccata: 176; pungens: 105; aria: 90; caprea: 249; pennsylvanica: 127; Royalty: 17; trichocarpa: 6; decidua: 108; Määrittelemättä: 286; virginiana: 59; domestica: 194; pensylvanicum: 106; euchlora: 42; x berolinensis: 24; omorika: 522; douglasii: 384; peuce: 360; Linnanmäki: 7; tataricum: 359; Hyvingiensis: 48; alleghaniensis: 96; canadensis: 28; ailanthifolia: 32; balsamifera: 33; gmelinii: 23; albosinensis: 3; communis: 136; glauca: 18; x flaccida: 6; petraea: 3; cerasus: 119; balsamea: 12; 'Woobstii': 10; hybridi: 2; rubra: 143; avium: 42; laevigata: 27; suaveolens: 36; x generosa: 8; ermanii: 8; x mordenensis: 47; Aldenhamensis: 1; cuspidata: 6; spicata: 2; vulgaris: 25; monogyna: 23; campestre: 30; Petrowskiana: 11; engelmannii: 2; japonicum: 47; octandra: 4; x rubens 'Lasipalatsi': 51; rubrum: 227; null: 1; saccharinum: 53; cinerea: 14; pensylvanica: 382; concolor: 19; fragilis: 513; Nipissing: 1; x robusta: 29; submollis: 28; sitchensis: 21; tataricum ssp. ginnala: 1; viminalis: 1; x pendulina: 1; alpinum: 11; saccharum: 11; platyphylla: 1; opulus: 1; x media: 15; europaeus: 7; prunifolia: 34; amurense: 55; pentandra: 13; Eleyi: 1; wilsonii: 4; rhipidophylla: 1; x wettsteinii: 1; grandifolia: 10; hirsuta: 1; rugosa: 3; densata: 4; macrocarpa: 3; commixta: 21; scopulina: 3; kaempferi: 16; mandschurica: 4; ussuriensis: 5; rhoifolia: 99; mandshurica: 18; plicata: 123; mariesii: 37; x canadensis: 10; amabilis: 127; lasiocarpa: 42; glabrum: 4; spicatum: 16; crispa: 3; sinuata: 2; tenuifolia: 3; Belgisch Rood: 1; colurna: 8; pisifera: 11; diversifolia: 42; heterophylla: 192; 'Birgitta': 10; toringo: 12; alnifolia: 10; Alba plena: 2; mertensiana: 104; betulus: 126; Sargentii-ryhmä: 7; x sepulcralis: 1; pictum: 2; tegmentosum: 68; cornuta: 18; caroliniana: 6; acuminata: 7; carpinifolia: 4; kobus: 30; Sato Zakura -Ryhmä: 2; veitchii: 9; mariana: 30; holophylla: 11; 'Dodong': 207; palustris: 7; fraxinifolia: 3; biloba: 5; rhynchophylla: 4; homolepis: 4; koreana: 10; triflorum: 84; mandshuricum: 29; amurensis: 7; planipes: 103; 'Joseph Rock': 1; mollis: 1; japonica: 12; turbinata: 1; obovata: 2; furcatum: 3; palmatum: 2; micranthum: 1; cissifolium: 1; pictus: 1; brachycarpum: 2; obassia: 2; bicolor: 3; hamiltonianus: 3; maximowiczii: 36; tanakae: 3; tschonoskii: 4; verticillata: 8; campanulatus: 4; cernuus: 1; schlippenbachii: 30; pseudocamellia: 3; albrechtii: 6; dolabrata: 3; crataegifolium: 1; sieboldianum: 2; barbinervis: 2; rufinerve: 2; tomentosa: 1; arborescens: 9; 'Professor Sprenger': 1; 'Pourpre Noir': 1; x schuschuenensis: 1; folgneri: 2; x hyacinthiflora: 4; viscosum: 3; x chinensis: 5; 'Van Eseltine': 5; cerasifera: 6; ellipsoidalis: 1; sanguinea: 3; circinatum: 6; alternifolia: 78; crus-galli: 2; heldreichii: 1; fraseri: 2; niveum: 2; nordmanniana: 3; procera: 3; 'White Dome': 3; contorta: 6; grandis: 3; orientalis: 2; x lutzii: 1; asperata: 1; glehnii: 1; glyptostroboides: 1; sachalinensis: 1; ponderosa: 1; JEZOENSIS: 1; rubens: 2; nephrolepis: 1; bornmuelleriana: 3; koraiensis: 3; decora: 2; scalaris: 1; torminalis: 3; regia: 1; trautvetteri: 1; minor: 4; caucasicus: 3; mougeotii: 1; mas: 4; vulgare: 4; luteum: 2; macranthera: 1; laurocerasus: 4; sempervirens: 3; pinnata: 1; javorkae: 1; verrucosus: 1; 'Wredei': 1; kiusiana: 1; americana: 46; insularis: 1; 'Zwarte Linde': 1; ferrugineum: 3; hirsutum: 3; pseudosieboldianum: 92; mucronulatum: 2; tristis: 1; carolina: 1; kentukea: 6; floribunda: 1; ovata: 2; maximum: 3; cordiformis: 1; atropurpureus: 1; trifolia: 1; lenta: 8; rafinesquianum: 1; floridus: 1; vaseyi: 8; peregrina: 1; fruticosa: 2; monticola: 1; tripetala: 3; x juranyana: 1; imbricaria: 1; laciniosa: 1; vernalis: 2; coccinea: 1; 'Alba Superba': 1; albidum: 1; prattii: 1; pohuashanensis: 1; pectinatum: 1; chinensis: 3; kousa: 2; bungeanus: 3; hupehensis: 1; barbinerve: 94; wardii: 1; senticosus: 1; fargesii: 2; pumila: 2; coreana: 1; serrata: 4; kansuensis: 1; heteromalla: 1; longiracemosum: 1; pekinensis: 1; carlesii: 1; sieboldiana: 2; vilmorinii: 4; holocarpa: 1; griseum: 1; sambucifolia: 1; kamtschatensis: 1; distichum: 1; hispidus: 1; nootkatensis: 4; pauciflora: 1; mongolica: 2; quinquefolium: 3; cercidifolius: 2; glabrescens: 2; paniculata: 2; prinophyllum: 3; sieboldii: 2; alpigena: 1; 'Ural2': 1; hillieri: 12; 'Humboldt': 1; banksiana: 15; engleriana: 2; tulipifera: 1; dasystyla: 1; angustifolia: 3; meinichii: 2; 'V.H.Rutgers': 1; begoniifolia: 1; maximowiczianum: 1; reticulata: 19; Profusion: 4; x arnoldiana: 1; Vulgaris-Ryhmä: 7; regelii: 18; Ranetka: 4; Preston-Ryhmä: 3; x henryi: 9; 'Wadas Memory': 1; aralioides: 3; standishii: 6; obtusiloba: 1; anomala: 1; florida: 1; mahaleb: 1; firma: 1; maximowicziana: 1; oliveri: 1; floridana: 1; 'Delila': 1; japonicus: 1; degronianum: 1; sikkimensis: 1; 'Puncta': 3; borisii-regis: 1; thomasii: 1; monspessulanum: 1; populifolia: 1; magnificum: 1; 'Freya': 1; parviflora: 1; chichibuensis: 1; x lemoinei: 2; 'Bouquet Blanc': 1; 'Belle Etoile': 1; 'Manteau d'Hermine': 1; sanguineum: 2; miyabei: 1; mollissima: 1; argutum: 1; serotina: 1; illinoensis: 1; chrysantha: 1; tenuifolius: 1; kolomikta: 1; bumalda: 1; breweriana: 1; henryi: 1; nipponicum: 1; Kirjailija: 15; 'Hesperia': 20; Makamik: 173; serrulata: 27; Prunifolia-Ryhmä: 17; Wabiscaw: 10; daniellii: 1; 'Legend': 6; x eminens: 3; x gondouinii: 8; 'Autumn Spire': 3; 'Odin': 13; x europaea 'Koningslinde': 18; accolade: 62; uva-crispa: 4; nigrum: 6; Aamurusko: 19; Angustifolium-Ryhmä: 6; triandra: 9; Dolgo: 2; Rixi: 2; Hopa: 1; Kuohu: 5; Kadetti: 4; x thuringiaca: 18; Cowichan: 7; Sibirica: 17; x freemanii: 14; x loebneri: 6; serrula: 7; nipponica: 8; x yedoensis: 32; frainetto: 5; ukurunduense: 1; 'Kaupunginpuutarha': 3; 'Olga': 4; koehneana: 8; Tumma kaunotar: 2; Erstaa: 4; Vitellina Tristis: 2; simonii: 3; lamarckii: 8; x persimilis: 5; Oekonomierat Echtermeyer: 2; 'Polkagris': 7; x carnea: 1; rhamnoides: 7; chlorosarca: 1; sabina: 1; x schwerinii: 19; Hollandica: 2; x pubescens: 12
- **kokoluokka**: 0 - 10 cm: 15557; 30 - 50 cm: 13348; 10 - 20 cm: 13334; 20 - 30 cm: 9471; null: 8939; 50 - 70 cm: 4938; 70 cm -: 1657

## avoindata:YLRE_Katualue_alue

7,769 records; estimated 16.5 MB; Polygon.

Fields:

- katualue_id (number)
- katualueen_nro (int)
- katu_id (number)
- kadun_nimi (string)
- luokka (string)
- katuluokka_id (number)
- kayttotark_id (number)
- kayttotarkoitus (string)
- yllapitoluokka (string)
- kadunpitopaatos_pvm (date-time)
- rakentamisen_tila (string)
- omistaja (string)
- vuokraus (string)
- vuokraaja (string)
- kaupunginosa (string)
- osa_alue (string)
- suurpiiri (string)
- pituus (number)
- keskim_leveys (number)
- pinta_ala (number)
- paivitetty_pvm (date-time)
- datanomistaja (string)
- paivitetty_tietopalveluun (date)
- geom (Geometry)

Type and class values (value: count):

- **luokka**: Asemakaavan mukainen: 7258; Yleisen alueen mukainen: 244; Kaavoittamaton: 193; Asemakaavan vastainen: 71; Yleisen alueen vastainen: 3
- **katuluokka_id**: 0: 5365; 1: 92; 2: 278; 3: 891; 4: 1078; 5: 64; 6: 1
- **kayttotark_id**: 1: 151; 2: 255; 41: 551; 61: 150; 101: 1296; 121: 9; 141: 5; 181: 2; 201: 93; 212: 303; 221: 289; 222: 548; 231: 3815; 232: 103; 233: 13; 234: 89; 241: 92; 298: 5
- **kayttotarkoitus**: Asuntokatu: 3815; Kevyt liikenne: 1296; Kevyt liikenne, t/h: 551; Kokoojakatu tai -tie: 548; Pääkatu: 303; Kokoojakatu alueellinen: 289; Pysäköintialue: 255; Tori: 151; Katuaukio: 150; Pihakatu: 103; Moottoriväylä: 93; Erillinen kev.liik.väylä: 92; Kävelykatu: 89; Hidaskatu: 13; Tontti: 9; Muu toimiluokka: 5; Yleinen tie: 5; Joukkoliikennekatu: 2
- **yllapitoluokka**: III: 6051; II: 1027; I: 396; H1: 295
- **rakentamisen_tila**: Valmis: 6149; Käytössä, ei luovutuskelpoinen: 503; Rakentamaton: 483; Osittain luovutettu: 406; Rakentaminen kesken: 193; Käytössä, ei kadunpitopäätöstä: 33; Ei määritelty: 2

## avoindata:YLRE_Katu_ja_viherosat_ajorata_alue

49,551 records; estimated 142.1 MB; Polygon.

Fields:

- osan_id (number)
- paakohde_tyyppi_id (number)
- paatyyppi (string)
- alakohde_tyyppi_id (number)
- alatyyppi (string)
- materiaali_id (number)
- materiaali (string)
- rakenteellinen_kunnossapito (string)
- talvikunnossapito (string)
- tkp_kiireellisyys_lk (string)
- viher_hoitoluokkka_id (number)
- laatutaso_id (number)
- yllapidon_taso (string)
- yllapidon_taso_selite (string)
- puhtaanapito (string)
- puhtaanapito_vyohyke (string)
- aluetieto (string)
- alueen_nimi (string)
- alueen_kayttotarkoitus (string)
- viheralueen_id (number)
- viheralueen_nro (number)
- katualueen_id (number)
- katualueen_nro (number)
- kadunpitopaatos_pvm (date)
- osan_nro (int)
- osan_pituus (number)
- osan_leveys (number)
- osan_pinta_ala (number)
- paivitetty_pvm (date)
- tyhjentava_talvikunnossapito (string)
- datanomistaja (string)
- paivitetty_tietopalveluun (date)
- geom (Geometry)

Type and class values (value: count):

- **paakohde_tyyppi_id**: 2: 49228; 30: 323
- **paatyyppi**: Ajorata: 49228; Silta: 323
- **alakohde_tyyppi_id**: 2: 13562; 3: 7503; 4: 3837; 5: 4524; 12: 19802; 464: 229; 465: 39; 466: 4; 467: 51
- **alatyyppi**: Tonttiliittymä: 19802; Ajorata: 13562; Koroke: 7503; Ajorata, muu: 4524; Pysäköintialue: 3837; Ajorata (Silta): 229; Ajorata, muu (Silta): 51; Koroke (Silta): 39; Pysäköintialue (Silta): 4
- **alueen_kayttotarkoitus**: Asuntokatu: 26095; Kokoojakatu tai -tie: 7370; Kokoojakatu alueellinen: 5843; Pääkatu: 4582; Asemakaavoitettu viheralue: 1407; Kevyt liikenne: 1252; Kevyt liikenne, t/h: 829; Moottoriväylä: 516; Pysäköintialue: 471; Pihakatu: 325; Tori: 197; Yleiskaavan viheralue: 115; Muu toimiluokka: 106; Katuaukio: 103; Kartano- ja huvila-alue: 90; Suojaviheralue: 34; Hidaskatu: 32; Venesatama / Venevalkama: 28; Erillinen kev.liik.väylä: 25; Joukkoliikennekatu: 16; Tontti (rakentamattomat / sopimus): 15; Siirtolapuutarha: 13; Yleiskaavan viheralue / luonnonsuojelualue: 11; Palstaviljelyalue: 9; Erityiskohteet, asemakaavoitettu viheralue: 9; Ulkoilumetsä: 8; Tontti: 7; Toiminta-alue: 7; Rata-alue: 7; Kävelykatu: 6; Yleinen tie: 6; Lähileikkipaikka: 5; Luonnonsuojelualue: 4; Uimaranta-alue: 2; Leikkipuisto: 2; Liikennealue: 1; Lumenkaatopaikka: 1; Yleiskaavan viheralue / erityiskohteet: 1; Kesämaja-alue: 1

## avoindata:YLRE_Katu_ja_viherosat_kaikki_alue

271,275 records; estimated 497.3 MB; Polygon.

Fields:

- tietopalvelu_id (int)
- osan_id (number)
- paakohde_tyyppi_id (number)
- paatyyppi (string)
- alakohde_tyyppi_id (number)
- alatyyppi (string)
- materiaali_id (number)
- materiaali (string)
- rakenteellinen_kunnossapito (string)
- talvikunnossapito (string)
- tkp_kiireellisyys_lk (string)
- viher_hoitoluokkka_id (number)
- laatutaso_id (number)
- yllapidon_taso (string)
- yllapidon_taso_selite (string)
- puhtaanapito (string)
- puhtaanapito_vyohyke (string)
- lisatieto (string)
- aluetieto (string)
- alueen_nimi (string)
- alueen_kayttotarkoitus (string)
- viheralueen_id (number)
- viheralueen_nro (number)
- katualueen_id (number)
- katualueen_nro (number)
- kadunpitopaatos_pvm (date-time)
- osan_nro (int)
- osan_pituus (number)
- osan_leveys (number)
- osan_pinta_ala (number)
- kappalemaara (int)
- muutos_vuosi (int)
- muutos_tyyppi (string)
- muutos_toimenpide (string)
- paivitetty_pvm (date-time)
- paivittaja (string)
- paivitetty_tietopalveluun (date)
- datanomistaja (string)
- geom (Geometry)

Type and class values (value: count):

- **paakohde_tyyppi_id**: 2: 49228; 3: 61540; 23: 63997; 24: 5599; 25: 16928; 26: 21256; 27: 6128; 28: 35830; 29: 6614; 30: 1539; 32: 926; 33: 1690
- **paatyyppi**: Nurmikot ja niityt: 63997; Kevyt liikenne: 61540; Ajorata: 49228; Muu rakenneosa: 35830; Muut alueet: 21256; Puut, pensaat ja köynnökset: 16928; Varusteet: 6614; Erityiskohteet: 6128; Kukkakasvit: 5599; Kentät: 1690; Silta: 1539; Kalusteet ja leikkivälineet: 926
- **alakohde_tyyppi_id**: 2: 13562; 3: 7503; 4: 3837; 5: 4524; 6: 3126; 7: 17260; 8: 696; 9: 8127; 10: 5188; 11: 4050; 12: 19802; 14: 2109; 16: 45; 17: 55; 18: 14; 19: 792; 40: 6575; 80: 3; 100: 1285; 101: 1895; 102: 73; 104: 2; 120: 198; 220: 68; 237: 1682; 260: 148; 269: 881; 271: 924; 272: 46467; 273: 438; 276: 106; 277: 5123; 279: 288; 281: 15119; 282: 165; 283: 524; 284: 823; 285: 1; 292: 4527; 293: 545; 294: 682; 295: 8401; 296: 1774; 297: 430; 298: 370; 300: 12949; 301: 284; 302: 2910; 303: 45; 304: 22; 305: 11; 306: 472; 307: 9; 308: 92; 309: 144; 310: 197; 311: 813; 312: 99; 313: 70; 314: 369; 315: 71; 316: 99; 333: 2571; 334: 351; 337: 45; 338: 48; 341: 197; 342: 464; 343: 51; 344: 6; 345: 365; 346: 2; 347: 93; 348: 397; 357: 21; 358: 981; 367: 425; 368: 364; 390: 243; 395: 34; 400: 104; 411: 1; 444: 84; 447: 2789; 448: 175; 449: 47; 450: 15636; 451: 23; 452: 2324; 453: 2582; 454: 1132; 455: 27331; 464: 229; 465: 39; 466: 4; 467: 51; 468: 46; 469: 160; 470: 17; 471: 187; 472: 87; 473: 99; 474: 2; 475: 9; 478: 301; 479: 3; 480: 41; 481: 1; 483: 164; 484: 519; 491: 293; 492: 18; 493: 805; 515: 1; 534: 82; 598: 9; 599: 7; 619: 17; 639: 99; 679: 228; 699: 8
- **alatyyppi**: Ajorata: 13562; Jalankulkualue: 17260; Nurmikko: 46467; Kevyt liikenne: 3126; Metsä: 12949; Tonttiliittymä: 19802; Yhdistetty jk ja pp: 8127; Niityt: 4527; Puistokäytävät: 15636; Pensasryhmät/massaistutukset: 15119; Erotettu pyörätie: 4050; Koroke: 7503; Erotettu jalkakäytävä: 5188; Portaat: 2109; Erotusalue: 27331; Perennat: 5123; D, niitto 1 x, jätettä ei poisteta: 1774; Ajorata (Silta): 229; Pintavesikourut: 924; Pysäköintialue: 3837; Aukiot: 2582; Pensasaita (leikattu): 524; Pensasaidanne (vapaasti kasv.): 823; Ajorata, muu: 4524; C, niitto 2 x, jätettä ei poisteta: 8401; Rakennukset: 2789; Pyöräilyalue/kaista: 696; Tukimuuri: 2571; Muu katutilan osa: 792; Yhdistetty jk ja pp (Silta): 187; Luonnonnurmi/apilanurmi: 438; Muu rakenne: 1895; Lämmitettävät portaat: 197; Muu alue: 1285; B, niitto 1 x, jäte poistetaan: 682; Pihapiiri: 981; Pyöräilyalue/kaista (Silta): 17; F, vesomalla hoidettavat niityt: 430; Ruovikko: 370; Jalankulkualue (Silta): 160; Merivesi-alue: 369; A, niitto 2 x, jäte poistetaan: 545; Oja, ojanne: 1682; Polku: 2324; Reunapalkki (Silta): 99; Melumuuri: 84; Joki/puro: 813; Avokallio: 2910; Näkemäalueen pensaat: 165; Puistokäytävät (Silta): 301; Erotusalue (Silta): 164; Koroke (Silta): 39; Erotettu jalkakäytävä (Silta): 87; Erotettu pyörätie (Silta): 99; Juuristoritilä: 6575; Kesäkukkaryhmät: 288; Melueste: 45; Istutusallas: 243; Katuvihreä: 14; Koristemuuri: 351; Rantamuurit: 197; Paasikivet: 397; Kevyt liikenne (Silta): 46; Muu varuste: 73; Laiturit, aallonmurtajat: 365; Rantakiveys: 464; Joutomaa: 92; Ajorata, muu (Silta): 51; Terassit: 99; Portaat (Silta): 9; Pelastusreitit: 175; Leikkikenttä: 805; Jättömaa (vaihettumisvyöhyke): 144; Reunatuet: 881; Hiekkaranta: 70; Kosteikko: 45; Turva-alustat: 1132; Hiekkalaatikko: 364; Pelikenttä: 519; Katsomot ja lavat: 104; Maakivet eli kivipulterit: 93; Pergola, huvimaja: 71; Koiranulkoilualue: 293; Koristeallas: 48; Shakkilaudat: 34; Kahluuallas: 45; Lammikko: 99; Linnoituslaitteet: 425; Viljelyspalstat: 472; Ryhmäruusut: 106; Pelto: 284; E, käsityövaltaiset kohteet: 198; H, arvoniityt, erillinen hoito-ohje: 148; Dynaaminen istutusalue: 228; Arvokasluontokohde: 11; Kevyt liikenne, muu (Silta): 2; Oma varastoalue: 21; Skeittikenttä: 55; Kitumaa: 9; Polku (Silta): 41; Patorakenteet: 51; Suo: 22; Ratsastusreitit: 47; Ratsastuskenttä: 18; Havupuuaita, leikattu: 68; Luontopolku (Silta): 3; G, laidunnus: 3; Koristepuro: 2; Luontopolku: 23; Pysäköintialue (Silta): 4; Vesileikki: 6; Aukiot (Silta): 1; Koristeheinät ja Sarat: 82; Hulevesiallas: 7; Maanalainen tila: 17; Panttijuomakeräysastia: 9; Jäte Koirankakkapussiteline: 1; Köynnöspylväs: 8; Köynnökset: 1; Kivi: 2; Muut kalusteet ja varusteet: 1
- **alueen_kayttotarkoitus**: Asuntokatu: 80220; Kevyt liikenne, t/h: 5925; Kokoojakatu tai -tie: 28027; Kevyt liikenne: 10721; Kokoojakatu alueellinen: 21438; Pysäköintialue: 1710; Tori: 3297; Pihakatu: 1531; Pääkatu: 19950; Katuaukio: 1426; Hidaskatu: 167; Tontti: 120; Moottoriväylä: 1474; Erillinen kev.liik.väylä: 456; Muu toimiluokka: 1525; Kävelykatu: 482; Asemakaavoitettu viheralue: 70954; Kesämaja-alue: 1000; Luonnonsuojelualue: 641; Lähileikkipaikka: 2796; Ulkoilumetsä: 358; Suojaviheralue: 1203; Katualue: 38; Haudat (hautausmaat): 128; Kartano- ja huvila-alue: 2783; Leikkipuisto: 3730; Koira-aitaus: 521; Tontti (rakentamattomat / sopimus): 494; Yleiskaavan viheralue / kesämaja-alue: 44; Erityiskohteet, asemakaavoitettu viheralue: 1329; Lähiliikuntapaikka: 779; Palstaviljelyalue: 1351; Uimaranta-alue: 148; Yleiskaavan viheralue / leikkipuisto: 32; Yleiskaavan viheralue: 2178; Siirtolapuutarha: 514; Venesatama / Venevalkama: 303; Yleiskaavan viheralue / luonnonsuojelualue: 287; Saari (saaret ilman siltayhteyttä): 60; Yleiskaavan viheralue / erityiskohteet: 658; Erityiskohteet / leikkipuisto: 14; Toiminta-alue: 29; Yleiskaavan viheralue / viljelypalsta: 23; Liikennealue: 15; Yleiskaavan viheralue / lähileikkipaikka: 24; Lumenkaatopaikka: 33; Rata-alue: 216; Yleinen tie: 14; Siirtolapuutarhan lähileikkipaikka: 29; Kesämaja-alue / lähileikkipaikka: 1; Joukkoliikennekatu: 79
- **muutos_tyyppi**: null: 204221; P: 38789; R: 28265

## avoindata:YLRE_Viheralue_alue

4,705 records; estimated 9.6 MB; Polygon.

Fields:

- viheralue_id (number)
- puistonumero (int)
- puistonimi_id (number)
- puiston_nimi (string)
- osoite (string)
- kaavamerkinta (string)
- kaavamerkinta_teksti (string)
- luokka (string)
- kayttotark_id (number)
- kayttotarkoitus (string)
- omistaja (string)
- vuokraus (string)
- vuokraaja (string)
- rakentamisen_tila (string)
- kaupunginosa (string)
- osa_alue (string)
- suurpiiri (string)
- viheralueen_pa (number)
- alue_luonti_pvm (date-time)
- paivitetty_pvm (date-time)
- datanomistaja (string)
- paivitetty_tietopalveluun (date)
- geom (Geometry)

Type and class values (value: count):

- **luokka**: Asemakaavan mukainen: 4339; Kaavoittamaton: 335; Asemakaavan vastainen: 28; Yleisen alueen mukainen: 3
- **kayttotark_id**: 1: 2844; 21: 117; 41: 11; 61: 42; 81: 4; 101: 37; 121: 53; 161: 101; 201: 27; 221: 15; 261: 44; 281: 16; 301: 88; 321: 178; 401: 129; 421: 289; 821: 69; 1201: 27; 1601: 20; 2801: 2; 3201: 1; 3601: 5; 3621: 19; 4001: 1; 4401: 23; 4801: 17; 4821: 49; 5201: 4; 5601: 2; 6001: 2; 6401: 8; 6801: 458; 7221: 1; 7241: 1; 7621: 1
- **kayttotarkoitus**: Asemakaavoitettu viheralue: 2844; Lähiliikuntapaikka: 458; Lähileikkipaikka: 289; Yleiskaavan viheralue: 178; Koira-aitaus: 129; Suojaviheralue: 117; Muu toimiluokka: 101; Palstaviljelyalue: 88; Leikkipuisto: 69; Luonnonsuojelualue: 53; Yleiskaavan viheralue / erityiskohteet: 49; Tontti (rakentamattomat / sopimus): 44; Kartano- ja huvila-alue: 42; Kesämaja-alue: 37; Venesatama / Venevalkama: 27; Saari (saaret ilman siltayhteyttä): 27; Rata-alue: 23; Uimaranta-alue: 20; Yleiskaavan viheralue / luonnonsuojelualue: 19; Erityiskohteet, asemakaavoitettu viheralue: 17; Ulkoilumetsä: 16; Siirtolapuutarha: 15; Haudat (hautausmaat): 11; Siirtolapuutarhan lähileikkipaikka: 8; Yleiskaavan viheralue / viljelypalsta: 5; Katualue: 4; Toiminta-alue: 4; Lumenkaatopaikka: 2; Liikennealue: 2; Yleiskaavan viheralue / lähileikkipaikka: 2; Erityiskohteet / leikkipuisto: 1; Yleiskaavan viheralue / leikkipuisto: 1; Yleiskaavan viheralue / kesämaja-alue: 1; Kesämaja-alue / lähileikkipaikka: 1; Leirintäalue: 1
- **rakentamisen_tila**: Valmis: 4422; Rakentamaton: 223; Rakentaminen kesken: 44; Ei määritelty: 16

