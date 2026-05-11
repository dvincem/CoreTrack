const fs = require('fs');
let content = fs.readFileSync('src/pages/ReturnsPage.jsx', 'utf8');

const targetStr = `<div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button 
                className={\`ret-btn \${!legacyMode ? 'ret-btn-sky' : 'ret-btn-outline'}\`}
                style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem' }}
                onClick={() => { setLegacyMode(false); setSelectedOrder(null); setSelectedOrderItem(null); setSelectedMasterItem(null); setSuppQuery(""); }}
              >Search by Purchase Order</button>
              <button 
                className={\`ret-btn \${legacyMode ? 'ret-btn-orange' : 'ret-btn-outline'}\`}
                style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem' }}
                onClick={() => { setLegacyMode(true); setSelectedOrder(null); setSelectedOrderItem(null); setSelectedMasterItem(null); setMasterQuery(""); }}
              >Legacy / No PO Return</button>
            </div>

            {!legacyMode ? (
              <>
                <label className="ret-label">Search by Order ID (RECEIVED orders only)</label>
                <div className="ret-search-wrap">`;

const replacementStr = `<div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '0.5rem', width: '280px', flexShrink: 0, marginTop: '1.2rem' }}>
                <button 
                  className={\`ret-btn \${!legacyMode ? 'ret-btn-sky' : 'ret-btn-outline'}\`}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', height: '38px' }}
                  onClick={() => { setLegacyMode(false); setSelectedOrder(null); setSelectedOrderItem(null); setSelectedMasterItem(null); setSuppQuery(""); }}
                >Search by Purchase Order</button>
                <button 
                  className={\`ret-btn \${legacyMode ? 'ret-btn-orange' : 'ret-btn-outline'}\`}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem', height: '38px' }}
                  onClick={() => { setLegacyMode(true); setSelectedOrder(null); setSelectedOrderItem(null); setSelectedMasterItem(null); setMasterQuery(""); }}
                >Legacy / No PO Return</button>
              </div>

              <div style={{ flex: 1 }}>
                {!legacyMode ? (
                  <>
                    <label className="ret-label">Search by Order ID (RECEIVED orders only)</label>
                    <div className="ret-search-wrap">`;

content = content.replace(targetStr, replacementStr);

const targetStr2 = `                  )}
                </div>
              </>
            )}`;

const replacementStr2 = `                  )}
                </div>
              </>
            )}
            </div>
            </div>`;

// Note: targetStr2 may appear multiple times or not exactly match. Let's use string manipulation more carefully.
// I will just read the file and do it line by line.
