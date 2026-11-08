const fs = require('fs');
const path = require('path');

// 1. PurchaseOrders.jsx: replace ▶ with SVG chevron
const poPath = path.resolve('InventoryProject/src/features/inventory/PurchaseOrders.jsx');
let poContent = fs.readFileSync(poPath, 'utf8');

const oldPoChevron = `<span className={\`text-[10px] transition-transform \${expandedRow === po.id ? 'rotate-90' : ''}\`}>▶</span>`;
const newPoChevron = `<svg
                                  className={\`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 \${
                                    expandedRow === po.id ? 'rotate-90 text-zinc-900' : 'group-hover:text-zinc-700'
                                  }\`}
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>`;

if (poContent.includes('▶')) {
  poContent = poContent.replace(oldPoChevron, newPoChevron);
  fs.writeFileSync(poPath, poContent, 'utf8');
  console.log('Fixed PurchaseOrders.jsx chevron icon');
} else {
  console.log('PurchaseOrders.jsx does not have ▶ or already fixed');
}

// 2. SupplierPortal.jsx: replace ▼ with SVG chevron
const spPath = path.resolve('InventoryProject/src/features/inventory/SupplierPortal.jsx');
let spContent = fs.readFileSync(spPath, 'utf8');

const oldSpChevron = `<span className={\`text-[10px] transition-transform \${expandedId === po.id ? 'rotate-180' : ''}\`}>▼</span>`;
const newSpChevron = `<svg
                              className={\`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 \${
                                expandedId === po.id ? 'rotate-90 text-zinc-900' : 'group-hover:text-zinc-700'
                              }\`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>`;

if (spContent.includes('▼')) {
  spContent = spContent.replace(oldSpChevron, newSpChevron);
  fs.writeFileSync(spPath, spContent, 'utf8');
  console.log('Fixed SupplierPortal.jsx chevron icon');
}

// 3. Navbar.jsx: replace ▼ with SVG chevron
const navPath = path.resolve('InventoryProject/src/components/Navbar.jsx');
let navContent = fs.readFileSync(navPath, 'utf8');

const oldNavChevron = `<span className={\`text-[10px] transition-transform duration-200 \${effectiveExpanded === item.label ? 'rotate-180' : ''}\`}>▼</span>`;
const newNavChevron = `<svg
                    className={\`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 \${
                      effectiveExpanded === item.label ? 'rotate-180 text-white' : ''
                    }\`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>`;

if (navContent.includes(oldNavChevron)) {
  navContent = navContent.replace(oldNavChevron, newNavChevron);
  fs.writeFileSync(navPath, navContent, 'utf8');
  console.log('Fixed Navbar.jsx chevron icon');
}

// 4. TopSalesGrid.jsx: replace ▼ and ▲ with SVG chevrons
const topPath = path.resolve('InventoryProject/src/features/dashboard/components/TopSalesGrid.jsx');
let topContent = fs.readFileSync(topPath, 'utf8');

topContent = topContent.replace(
  `<span>{areAllCompacted ? '▼' : '▲'}</span>`,
  `<svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={areAllCompacted ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
              </svg>`
);

topContent = topContent.replace(
  `<span>{isCompacted ? '▼' : '▲'}</span>`,
  `<svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={isCompacted ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
                        </svg>`
);

topContent = topContent.replace(
  `Click to view items <span>▼</span>`,
  `Click to view items <svg className="w-3.5 h-3.5 text-zinc-500 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>`
);

fs.writeFileSync(topPath, topContent, 'utf8');
console.log('Fixed TopSalesGrid.jsx icons');

// 5. SupplierCatalogModal.jsx: replace ▲ and ▼ with micro arrow SVGs
const catPath = path.resolve('InventoryProject/src/features/inventory/components/SupplierCatalogModal.jsx');
let catContent = fs.readFileSync(catPath, 'utf8');

const oldUp = `▲ +₱{change.difference.toFixed(2)}`;
const newUp = `<svg className="w-2.5 h-2.5 text-amber-700 inline shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> +₱{change.difference.toFixed(2)}`;

const oldDown = `▼ -₱{Math.abs(change.difference).toFixed(2)}`;
const newDown = `<svg className="w-2.5 h-2.5 text-emerald-700 inline shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> -₱{Math.abs(change.difference).toFixed(2)}`;

if (catContent.includes(oldUp)) {
  catContent = catContent.replace(oldUp, newUp);
  catContent = catContent.replace(oldDown, newDown);
  fs.writeFileSync(catPath, catContent, 'utf8');
  console.log('Fixed SupplierCatalogModal.jsx price change arrows');
}
