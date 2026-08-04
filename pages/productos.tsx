import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../lib/supabaseClient";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { theme } from "../lib/theme";
import { Card, Heading, Button, Badge, inputStyle } from "../lib/ui";

// Usamos el cliente compartido (singleton) en vez de crear una instancia
// propia con createClient(). Ver nota en fabricacion.tsx: varias instancias
// de Supabase Auth compitiendo por el mismo localStorage causaban lecturas
// de sesión intermitentes (a veces detectaba al usuario, a veces no).
const supabase = getSupabase();

type Producto = {
  SKU: string;
  Ítem: string;
  Familia: string;
  Descripción: string;
  Especificaciones: string;
  precio_a: number;
  precio_b: number;
  precio_c: number;
  precio_d: number;
  estado_inventario: string;
  image_url?: string;
};

type ItemCarrito = {
  SKU: string;
  nombre: string;
  cantidad: number;
  precio: number;
  descripcion?: string;
};

export default function Productos() {
  const router = useRouter();
  const [categoria, setCategoria] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // Estados para Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 12;

  // Estado para la referencia única con prefijo QT- y fecha/hora precisa
  const [referenciaActual, setReferenciaActual] = useState<string>("");

  // Estados robustos para los datos del cliente automatizados
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [representante, setRepresentante] = useState("");
  const [mailCliente, setMailCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [clienteData, setClienteData] = useState<any>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);

  useEffect(() => {
    const generarReferenciaUnica = () => {
      const timestamp = Date.now().toString().slice(-6);
      const randomNum = Math.floor(100 + Math.random() * 900);
      return `QT-${timestamp}-${randomNum}`;
    };
    setReferenciaActual(generarReferenciaUnica());

    const fetchClientInfo = async () => {
      try {
        let userEmail = "";

        const { data: { user } } = await supabase.auth.getUser();

        if (user?.email) {
          userEmail = user.email.trim();
        } else {
          // Fallback: por ahora seguimos leyendo localStorage, ya que el
          // login del portal parece manejar su propia sesión (no Supabase
          // Auth). Hay que confirmar cómo guarda la sesión para hacer
          // esto de forma robusta en vez de este fallback.
          const localEmail = typeof window !== "undefined"
            ? (localStorage.getItem("userEmail") || localStorage.getItem("email") || localStorage.getItem("clienteEmail"))
            : "";
          if (localEmail) userEmail = localEmail.trim();
        }

        if (!userEmail) {
          setNombreEmpresa("No autenticado");
          setCargandoSesion(false);
          return;
        }

        const { data: cliente, error: dbError } = await supabase
          .from("clientes")
          .select("*")
          .ilike("email", userEmail)
          .maybeSingle();

        if (dbError) {
          console.error("Error al consultar la tabla clientes:", dbError);
        }

        if (cliente) {
          setClienteData(cliente);
          setNombreEmpresa(cliente.razon_social || "Cliente General");
          setRepresentante(cliente.nombre_representante || "No especificado");
          setMailCliente(cliente.email || userEmail);
          setTelefonoCliente(cliente.telefono_celular || cliente.telefono_oficina || "N/D");
        } else {
          setNombreEmpresa(userEmail);
          setRepresentante("No especificado");
          setMailCliente(userEmail);
          setTelefonoCliente("N/D");
        }
      } catch (err) {
        console.error("Excepción al obtener la información del cliente:", err);
      } finally {
        setCargandoSesion(false);
      }
    };

    fetchClientInfo();
  }, [router]);

  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCotizacion = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  const handleCantidadChange = (sku: string, valor: number) => {
    setCantidades({ ...cantidades, [sku]: valor });
  };

  const agregarAlCarrito = (prod: Producto) => {
    const qty = cantidades[prod.SKU] || 1;
    const precioSeleccionado = prod.precio_a || 0;
    setCarrito([...carrito, { SKU: prod.SKU, nombre: prod.Descripción || prod.Ítem, cantidad: qty, precio: precioSeleccionado, descripcion: prod.Descripción }]);
    setCantidades({ ...cantidades, [prod.SKU]: 1 });
  };

  const eliminarDelCarrito = (index: number) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  const vaciarCarrito = () => {
    setCarrito([]);
  };

  const calcularFechaEntrega = () => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 3);
    return hoy.toISOString().split('T')[0];
  };

  const guardarCotizacionEnSupabase = async (referenciaUnica: string, pdfPublicUrl: string) => {
    const itemsFormateados = carrito.map(item => ({
      SKU: item.SKU,
      descripcion: item.nombre || item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precio,
      total: item.precio * item.cantidad
    }));

    const payloadQuote = {
      // NOTA: user_id se quitó del payload. La tabla quotes tiene un foreign
      // key hacia "profiles", pero los usuarios creados vía Auth admin
      // (activar-password.ts) no generan fila en "profiles", lo que rompía
      // el guardado con error 23503. Toda la info del cliente ya se guarda
      // directamente (empresa, representante, email, telefono_celular),
      // así que no se necesita user_id para identificar al cliente aquí.
      referencia: referenciaUnica,
      type: 'producto',
      empresa: clienteData?.razon_social || nombreEmpresa,
      representante: clienteData?.nombre_representante || representante,
      email: clienteData?.email || mailCliente,
      telefono_celular: clienteData?.telefono_celular || telefonoCliente,
      total: totalCotizacion,
      items: itemsFormateados,
      status: 'pending',
      pdf_url: pdfPublicUrl,
      fecha_estimada_entrega: calcularFechaEntrega()
    };

    // Verificamos si ya existe la cotización con esta referencia usando la tabla 'quotes'
    const { data: existente } = await supabase
      .from('quotes')
      .select('id')
      .eq('referencia', referenciaUnica)
      .maybeSingle();

    let resultado;
    if (existente) {
      resultado = await supabase
        .from('quotes')
        .update(payloadQuote)
        .eq('referencia', referenciaUnica)
        .select();
    } else {
      resultado = await supabase
        .from('quotes')
        .insert([payloadQuote])
        .select();
    }

    if (resultado.error) {
      console.error("ERROR DETALLADO DE SUPABASE:", resultado.error);
      throw new Error(resultado.error.message);
    }

    const dataRes = Array.isArray(resultado.data) ? resultado.data[0] : resultado.data;
    return dataRes;
  };

  const generarDocumentoPDF = () => {
    const fechaActual = new Date().toLocaleDateString();
    const horaActual = new Date().toLocaleTimeString();

    const doc = new jsPDF();
    doc.addImage("/images/logo.png", "PNG", 14, 10, 40, 20);

    doc.setFontSize(10);
    doc.text(`Referencia: ${referenciaActual}`, 150, 20);
    doc.text(`Fecha: ${fechaActual}`, 150, 26);
    doc.text(`Hora: ${horaActual}`, 150, 32);

    doc.setFontSize(9);
    doc.text(`Cliente: ${nombreEmpresa || "N/D"}`, 14, 42);
    doc.text(`Representante: ${representante || "N/D"}`, 14, 48);
    doc.text(`Mail: ${mailCliente || "N/D"}`, 14, 54);
    doc.text(`Tel: ${telefonoCliente || "N/D"}`, 14, 60);

    doc.setFontSize(16);
    doc.text("TRULINK FIBER LLC", 14, 70);
    doc.setFontSize(10);
    doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111", 14, 76);
    doc.text("Tel: +507 6640 3720", 14, 82);
    doc.text("www.trulinkfiber.com", 14, 88);

    const rows = carrito.map(item => [
      item.SKU,
      item.nombre,
      item.cantidad.toString(),
      `$${item.precio.toFixed(2)}`,
      `$${(item.precio * item.cantidad).toFixed(2)}`
    ]);

    (doc as any).autoTable({
      head: [["SKU", "Descripción", "Cant", "P. Unitario", "Total"]],
      body: rows,
      startY: 96,
      styles: { fontSize: 10, halign: "center" },
      headStyles: { fillColor: [218, 165, 32] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`TOTAL : $${totalCotizacion.toFixed(2)}`, 150, finalY);

    doc.setFontSize(10);
    doc.text("Precios: EXW PANAMÁ", 14, finalY + 10);
    doc.text("NOTA: Esta cotización es válida por 15 días a partir de la fecha de emisión.", 14, finalY + 16);
    doc.text("Forma de pago: 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.", 14, finalY + 22);
    doc.text("MÉTODOS DE PAGO: YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES", 105, finalY + 34, { align: "center" });

    try {
      const firma = "/images/firmaco.png";
      const props = doc.getImageProperties(firma);
      const firmaWidth = 40;
      const firmaHeight = (props.height * firmaWidth) / props.width;
      doc.addImage(firma, "PNG", 150, finalY + 42, firmaWidth, firmaHeight);
    } catch (e) {
      console.error("No se pudo cargar la firma:", e);
    }

    return doc;
  };

  const procesarPago = async () => {
    if (carrito.length === 0) {
      alert("La cotización está vacía. Por favor, agregue artículos.");
      return;
    }

    try {
      const doc = generarDocumentoPDF();
      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaActual}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      await guardarCotizacionEnSupabase(referenciaActual, pdfPublicUrl);
      router.push(`/checkout?id=${referenciaActual}`);

    } catch (err: any) {
      console.error("ERROR INESPERADO:", err);
      alert(`Ocurrió un error al procesar la solicitud: ${err.message || err}`);
    }
  };

  const generarPDF = async () => {
    if (carrito.length === 0) {
      alert("La cotización está vacía.");
      return;
    }

    try {
      const doc = generarDocumentoPDF();
      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaActual}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      await guardarCotizacionEnSupabase(referenciaActual, pdfPublicUrl);
      doc.save(`${referenciaActual}_TrulinkFiber.pdf`);
    } catch (err) {
      const doc = generarDocumentoPDF();
      doc.save(`${referenciaActual}_TrulinkFiber.pdf`);
    }
  };

  const seleccionarCategoria = async (tabla: string) => {
    const { data, error } = await supabase.from(tabla).select("*");
    if (!error) {
      setProductos(data || []);
      setCategoria(tabla);
      setPaginaActual(1);
    }
  };

  const indiceUltimoProducto = paginaActual * productosPorPagina;
  const indicePrimerProducto = indiceUltimoProducto - productosPorPagina;
  const productosActuales = productos.slice(indicePrimerProducto, indiceUltimoProducto);
  const totalPaginas = Math.ceil(productos.length / productosPorPagina);

  return (
    <div
      style={{
        backgroundColor: theme.background,
        color: theme.textLight,
        minHeight: "100vh",
        padding: "40px",
        fontFamily: theme.fontFamily,
      }}
    >
      <style jsx global>{`
        .image-zoom { transition: transform 0.3s, box-shadow 0.3s; }
        .image-zoom:hover { transform: scale(1.08); box-shadow: 0 0 20px 5px ${theme.gold}; cursor: pointer; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid ${theme.borderGold}; padding: 12px; text-align: center; color: ${theme.textLight}; }
        th { background-color: ${theme.gold}; color: ${theme.background}; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Button variant="outline-gold" onClick={() => router.push("/portal-cliente")}>
          ← Volver al Portal
        </Button>
        <Button
          variant="gold"
          onClick={() => document.getElementById('carrito-seccion')?.scrollIntoView({ behavior: 'smooth' })}
        >
          🛒 Carrito ({totalItems})
        </Button>
      </div>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "150px" }} />
        <h1 style={{ color: theme.gold, letterSpacing: "1px" }}>
          {categoria ? categoria.toUpperCase() : "PRODUCTOS TERMINADOS"}
        </h1>
      </div>

      {!categoria ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "30px", maxWidth: "1000px", margin: "0 auto" }}>
          {[
            { name: "Accesorios", img: "/images/nap.png", tabla: "accesoriosdb" },
            { name: "Cables", img: "/images/patch.png", tabla: "cablesdb" },
            { name: "Herrajes", img: "/images/dtype.png", tabla: "herrajesdb" }
          ].map((cat, idx) => (
            <div key={idx} onClick={() => seleccionarCategoria(cat.tabla)} style={{ cursor: "pointer" }}>
              <Card style={{ textAlign: "center", marginBottom: 0 }}>
                <img src={cat.img} alt={cat.name} style={{ width: "100%", borderRadius: "10px" }} />
                <Heading style={{ textAlign: "center", marginTop: 12, marginBottom: 0, fontSize: "1.3rem" }}>
                  {cat.name}
                </Heading>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <Button variant="outline-gold" onClick={() => setCategoria(null)} style={{ marginBottom: "20px" }}>
            ← Volver a Categorías
          </Button>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            {productosActuales.map((prod) => (
              <Card key={prod.SKU} style={{ textAlign: "center", marginBottom: 0 }}>
                <img
                  src={prod.image_url || "/placeholder.png"}
                  alt={prod.Ítem}
                  className="image-zoom"
                  onClick={() => window.open(`/producto/${prod.SKU}`, '_blank')}
                  style={{ width: "100%", height: "150px", objectFit: "contain", borderRadius: "10px", marginBottom: "10px", backgroundColor: theme.inputBg }}
                />
                <Badge tone="gold">{prod.SKU}</Badge>
                <p style={{ fontSize: "0.85rem", height: "40px", overflow: "hidden", marginTop: "10px" }}><strong>{prod.Ítem}</strong></p>
                <p style={{ fontSize: "0.9rem", color: theme.gold, margin: "5px 0" }}>Precio: ${prod.precio_a?.toFixed(2) || "0.00"}</p>
                <input
                  type="number"
                  min="1"
                  value={cantidades[prod.SKU] || 1}
                  onChange={(e) => handleCantidadChange(prod.SKU, parseInt(e.target.value) || 1)}
                  style={{ ...inputStyle, width: "50px", marginBottom: "5px", textAlign: "center" }}
                />
                <div>
                  <Button variant="gold" onClick={() => agregarAlCarrito(prod)} style={{ margin: "0 auto" }}>
                    Agregar
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "40px", alignItems: "center" }}>
              <Button
                variant="outline-gold"
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual(p => Math.max(p - 1, 1))}
              >
                ⬅ Anterior
              </Button>
              <span style={{ color: theme.textLight, fontWeight: "bold" }}>Página {paginaActual} de {totalPaginas}</span>
              <Button
                variant="outline-gold"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual(p => Math.min(p + 1, totalPaginas))}
              >
                Siguiente ➡
              </Button>
            </div>
          )}
        </div>
      )}

      <div id="carrito-seccion" style={{ maxWidth: "900px", margin: "60px auto" }}>
        <Card>
          <Heading style={{ textAlign: "center", fontSize: "1.3rem" }}>Mi Cotización ({referenciaActual})</Heading>
          {carrito.length === 0 ? (
            <p style={{ textAlign: "center", color: theme.textLight }}>El carrito está vacío.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Descripción</th>
                    <th>Cant</th>
                    <th>P. Unitario</th>
                    <th>Total</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.map((item, index) => (
                    <tr key={index}>
                      <td>{item.SKU}</td>
                      <td>{item.nombre}</td>
                      <td>{item.cantidad}</td>
                      <td>${item.precio.toFixed(2)}</td>
                      <td>${(item.precio * item.cantidad).toFixed(2)}</td>
                      <td>
                        <Button variant="outline-red" onClick={() => eliminarDelCarrito(index)} style={{ padding: "5px 10px", fontSize: "0.75rem" }}>
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px", paddingRight: "15px" }}>
                <h2 style={{ color: theme.gold, margin: 0, fontSize: "1.2rem" }}>TOTAL : ${totalCotizacion.toFixed(2)}</h2>
              </div>

              <div style={{ marginTop: "15px", color: theme.textLight, fontSize: "0.85rem", borderTop: `1px dashed ${theme.borderGold}`, paddingTop: "10px" }}>
                <p style={{ margin: "4px 0" }}><strong>Precios:</strong> EXW PANAMÁ</p>
                <p style={{ margin: "4px 0" }}><strong>NOTA:</strong> Esta cotización es válida por 15 días a partir de la fecha de emisión.</p>
                <p style={{ margin: "4px 0" }}><strong>Forma de pago:</strong> 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.</p>
                <p style={{ margin: "4px 0" }}><strong>MÉTODOS DE PAGO:</strong> YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES</p>
              </div>

              {cargandoSesion && (
                <p style={{ color: theme.gold, fontSize: "0.85rem", textAlign: "center", marginTop: "15px", fontStyle: "italic" }}>
                  Cargando datos del cliente, un momento...
                </p>
              )}
              <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "20px" }}>
                <Button variant="gold" onClick={generarPDF} disabled={cargandoSesion} style={{ padding: "15px 30px" }}>
                  GUARDAR PDF
                </Button>
                <Button variant="gold" onClick={procesarPago} disabled={cargandoSesion} style={{ padding: "15px 30px" }}>
                  Proceder con Pago
                </Button>
              </div>
              <Button variant="outline-red" onClick={vaciarCarrito} style={{ marginTop: "10px", width: "100%" }}>
                Vaciar carrito
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
