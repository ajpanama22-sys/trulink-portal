{/* 2. PASARELAS DE PAGO CON DISEÑO VERTICAL EXPANDIDO */}
            <div style={{ marginBottom: "35px" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "15px", borderLeft: "3px solid #DAA520", paddingLeft: "10px" }}>FLUJO DE INGRESOS POR PASARELA DE PAGO</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "20px" }}>
                
                {/* Stripe */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "20px", borderTop: "4px solid #635BFF", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "110px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <img src="/images/stripelogo.png" alt="Stripe" style={{ height: "28px", objectFit: "contain" }} />
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(218,165,32,0.2)" }}>{pctStripe}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#777", textTransform: "uppercase" }}>Stripe</span>
                    <h4 style={{ fontSize: "1.4rem", color: "#fff", margin: "2px 0 0 0", fontWeight: "bold" }}>${pagosStripe.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                  </div>
                </div>

                {/* PayPal */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "20px", borderTop: "4px solid #00457C", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "110px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <img src="/images/paypallogo.png" alt="PayPal" style={{ height: "28px", objectFit: "contain" }} />
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(218,165,32,0.2)" }}>{pctPaypal}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#777", textTransform: "uppercase" }}>PayPal</span>
                    <h4 style={{ fontSize: "1.4rem", color: "#fff", margin: "2px 0 0 0", fontWeight: "bold" }}>${pagosPaypal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                  </div>
                </div>

                {/* Wise */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "20px", borderTop: "4px solid #9FE870", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "110px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <img src="/images/wiselogo.png" alt="Wise" style={{ height: "28px", objectFit: "contain" }} />
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(218,165,32,0.2)" }}>{pctWise}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#777", textTransform: "uppercase" }}>Wise</span>
                    <h4 style={{ fontSize: "1.4rem", color: "#fff", margin: "2px 0 0 0", fontWeight: "bold" }}>${pagosWise.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                  </div>
                </div>

                {/* Transferencia / Banco */}
                <div style={{ backgroundColor: "#080808", border: "1px solid rgba(218,165,32,0.2)", borderRadius: "8px", padding: "20px", borderTop: "4px solid #DAA520", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "110px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#fff" }}>🏦 Transferencia</span>
                    <span style={{ fontSize: "0.75rem", color: "#DAA520", backgroundColor: "#111", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(218,165,32,0.2)" }}>{pctTrans}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "#777", textTransform: "uppercase" }}>Banco / Directo</span>
                    <h4 style={{ fontSize: "1.4rem", color: "#fff", margin: "2px 0 0 0", fontWeight: "bold" }}>${pagosTransferencia.toLocaleString("en-US", { minimumFractionDigits: 2 })}</h4>
                  </div>
                </div>

              </div>

              <div style={{ backgroundColor: "#111", borderRadius: "6px", height: "28px", display: "flex", overflow: "hidden", border: "1px solid rgba(218,165,32,0.3)", padding: "2px", gap: "2px" }}>
                <div style={{ width: `${pctStripe}%`, backgroundColor: "#635BFF", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#fff", fontWeight: "bold" }}>{pctStripe > 5 ? `${pctStripe}%` : ""}</div>
                <div style={{ width: `${pctPaypal}%`, backgroundColor: "#00457C", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#fff", fontWeight: "bold" }}>{pctPaypal > 5 ? `${pctPaypal}%` : ""}</div>
                <div style={{ width: `${pctWise}%`, backgroundColor: "#9FE870", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#000", fontWeight: "bold" }}>{pctWise > 5 ? `${pctWise}%` : ""}</div>
                <div style={{ width: `${pctTrans}%`, backgroundColor: "#DAA520", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#000", fontWeight: "bold" }}>{pctTrans > 5 ? `${pctTrans}%` : ""}</div>
              </div>
            </div>