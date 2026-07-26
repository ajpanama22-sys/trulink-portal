import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import "jspdf-autotable";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

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
};

export default function Productos() {
  const router = useRouter();
  const [categoria, setCategoria] = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [productosFiltrados, setProductosFiltrados] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState<string>("");
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // Estados para Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 12;

  // Estado para la referencia única con prefijo QT-
  const [referenciaActual, setReferenciaActual] = useState<string>("");

  // Estados para los datos del cliente automatizados
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [representante, setRepresentante] = useState("");
  const [mailCliente, setMailCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [tipoCliente, setTipoCliente] = useState<string>("A"); // Tier A, B, C o D

  useEffect(() => {
    // Generación de referencia única QT
    const generarReferenciaUnica = () => {
      const timestamp = Date.now().toString().slice(-6);
      const randomNum = Math.floor(100 + Math.random() * 900);
      return `QT-${timestamp}-${randomNum}`;
    };
    setReferenciaActual(generarReferenciaUnica());

    fetchClientInfo();
  }, []);

  const fetchClientInfo = async () => {
    let clienteMail = "";
    let clienteEmpresa = "";
    let clienteRep = "";
    let clienteTelefono = "";
    let clienteTipo = "A";

    const storedUser =
      sessionStorage.getItem("trulink_user") ||
      localStorage.getItem("trulink_user") ||
      sessionStorage.getItem("user") ||
      localStorage.getItem("user");

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        clienteMail = parsed.email || "";
        clienteEmpresa = parsed.razon_social || parsed.empresa || parsed.nombre || "";
        clienteRep = parsed.representante || parsed.nombre_representante || parsed.contacto || parsed.nombre || "";
        clienteTelefono = parsed.telefono || parsed.telefono_movil || parsed.celular || "";
        clienteTipo = parsed.tipo_cliente || parsed.rol || parsed.tipo || "A";
      } catch (e) {
        console.error("Error al leer datos locales del usuario:", e);
      }
    }

    if (supabase) {
      let authEmail = clienteMail;
      if (!authEmail) {
        const { data: { session } } = await supabase.auth.getSession();
        authEmail = session?.user?.email || "";
      }

      if (authEmail) {
        clienteMail = authEmail;
        const { data: clienteDB } = await supabase
          .from("clientes")
          .select("*")
          .ilike("email", authEmail.trim())
          .maybeSingle();

        if (clienteDB) {
          clienteEmpresa = clienteDB.razon_social || clienteDB.nombre || clienteEmpresa;
          // Mapeo exhaustivo para capturar el nombre correcto del representante sin importar la columna
          clienteRep = clienteDB.representante || clienteDB.nombre_representante || clienteDB.contacto || clienteDB.nombre || clienteRep;
          // Mapeo exhaustivo para capturar el teléfono sin importar la columna
          clienteTelefono = clienteDB.telefono || clienteDB.telefono_movil || clienteDB.celular || clienteTelefono;
          clienteMail = clienteDB.email || clienteMail;
          clienteTipo = clienteDB.tipo_cliente || clienteTipo;
        }
      }
    }

    setNombreEmpresa(clienteEmpresa || "Sin especificar");
    setRepresentante(clienteRep || "No especificado");
    setMailCliente(clienteMail || "No especificado");
    setTelefonoCliente(clienteTelefono || "No especificado");
    setTipoCliente(clienteTipo);
  };

  const obtenerDatosClienteFresco = async () => {
    let clienteMail = mailCliente;
    let clienteEmpresa = nombreEmpresa;
    let clienteRep = representante;
    let clienteTelefono = telefonoCliente;
    let clienteTipo = tipoCliente;

    if (!clienteMail || clienteMail === "No especificado" || clienteMail === "N/D") {
      const storedUser =
        sessionStorage.getItem("trulink_user") ||
        localStorage.getItem("trulink_user") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user");

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          clienteMail = parsed.email || clienteMail;
          clienteEmpresa = parsed.razon_social || parsed.empresa || parsed.nombre || clienteEmpresa;
          clienteRep = parsed.representante || parsed.nombre_representante || parsed.contacto || parsed.nombre || clienteRep;
          clienteTelefono = parsed.telefono || parsed.telefono_movil || parsed.celular || clienteTelefono;
          clienteTipo = parsed.tipo_cliente || parsed.rol || parsed.tipo || clienteTipo;
        } catch (e) {}
      }
    }

    if ((!clienteMail || clienteMail === "No especificado" || clienteMail === "N/D") && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      clienteMail = session?.user?.email || clienteMail;
    }

    if (clienteMail && clienteMail !== "No especificado" && clienteMail !== "N/D" && supabase) {
      const { data: clienteDB } = await supabase
        .from("clientes")
        .select("*")
        .ilike("email", clienteMail.trim())
        .maybeSingle();

      if (clienteDB) {
        clienteEmpresa = clienteDB.razon_social || clienteDB.nombre || clienteEmpresa;
        clienteRep = clienteDB.representante || clienteDB.nombre_representante || clienteDB.contacto || clienteDB.nombre || clienteRep;
        clienteTelefono = clienteDB.telefono || clienteDB.telefono_movil || clienteDB.celular || clienteTelefono;
        clienteMail = clienteDB.email || clienteMail;
        clienteTipo = clienteDB.tipo_cliente || clienteTipo;
      }
    }

    return {
      empresa: clienteEmpresa && clienteEmpresa !== "Sin especificar" ? clienteEmpresa : "Cliente General",
      representante: clienteRep && clienteRep !== "No especificado" && clienteRep !== "N/D" ? clienteRep : "No especificado",
      email: clienteMail && clienteMail !== "No especificado" && clienteMail !== "N/D" ? clienteMail : "No especificado",
      telefono: clienteTelefono && clienteTelefono !== "No especificado" && clienteTelefono !== "N/D" ? clienteTelefono : "No especificado",
      tipo: clienteTipo
    };
  };

  const getPrecioCliente = (prod: Producto): number => {
    const tier = (tipoCliente || "A").toString().trim().toUpperCase();
    if (tier === "B" || tier === "PRECIO_B" || tier === "CLIENTE B2B") return prod.precio_b ?? prod.precio_a ?? 0;
    if (tier === "C" || tier === "PRECIO_C") return prod.precio_c ?? prod.precio_a ?? 0;
    if (tier === "D" || tier === "PRECIO_D") return prod.precio_d ?? prod.precio_a ?? 0;
    return prod.precio_a ?? 0;
  };

  useEffect(() => {
    if (!busqueda.trim()) {
      setProductosFiltrados(productos);
    } else {
      const termino = busqueda.toLowerCase().trim();
      const filtrados = productos.filter(
        (prod) =>
          (prod.SKU && prod.SKU.toLowerCase().includes(termino)) ||
          (prod.Descripción && prod.Descripción.toLowerCase().includes(termino)) ||
          (prod.Familia && prod.Familia.toLowerCase().includes(termino))
      );
      setProductosFiltrados(filtrados);
    }
    setPaginaActual(1);
  }, [busqueda, productos]);

  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCotizacion = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  const handleCantidadChange = (sku: string, valor: number) => {
    setCantidades({ ...cantidades, [sku]: valor });
  };

  const agregarAlCarrito = (prod: Producto) => {
    const qty = cantidades[prod.SKU] || 1;
    const precioSeleccionado = getPrecioCliente(prod);
    setCarrito([...carrito, { SKU: prod.SKU, nombre: prod.Descripción, cantidad: qty, precio: precioSeleccionado }]);
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
    return hoy.toISOString().split("T")[0];
  };

  const guardarCotizacionEnSupabase = async (referenciaUnica: string, pdfPublicUrl: string, infoCliente: any) => {
    const itemsFormateados = carrito.map((item) => ({
      SKU: item.SKU,
      descripcion: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precio,
      total: item.precio * item.cantidad
    }));

    const datosCotizacion = {
      referencia: referenciaUnica,
      total: totalCotizacion,
      items: itemsFormateados,
      status: "pending",
      type: "producto",
      pdf_url: pdfPublicUrl,
      empresa: infoCliente.empresa,
      representante: infoCliente.representante,
      email: infoCliente.email,
      telefono: infoCliente.telefono,
      fecha_estimada_entrega: calcularFechaEntrega()
    };

    const { data: existente } = await supabase
      .from("quotes")
      .select("id")
      .eq("referencia", referenciaUnica)
      .maybeSingle();

    let resultado;
    if (existente) {
      resultado = await supabase
        .from("quotes")
        .update(datosCotizacion)
        .eq("referencia", referenciaUnica)
        .select();
    } else {
      resultado = await supabase
        .from("quotes")
        .insert([datosCotizacion])
        .select();
    }

    if (resultado.error) {
      console.error("ERROR DETALLADO DE SUPABASE:", resultado.error);
      throw new Error(resultado.error.message);
    }

    return Array.isArray(resultado.data) ? resultado.data[0] : resultado.data;
  };

  // Función auxiliar para cargar imágenes de forma asíncrona para jsPDF
  const cargarImagenComoBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = (err) => reject(err);
    });
  };

  const crearInstanciaPDF = async (infoCliente: any) => {
    const fechaActual = new Date().toLocaleDateString();
    const horaActual = new Date().toLocaleTimeString();

    const doc = new jsPDF();

    try {
      const logoBase64 = await cargarImagenComoBase64("/images/logo.png");
      doc.addImage(logoBase64, "PNG", 14, 10, 40, 20);
    } catch (e) {
      console.error("No se pudo cargar el logo en el PDF:", e);
    }

    doc.setFontSize(10);
    doc.text(`Referencia: ${referenciaActual}`, 150, 20);
    doc.text(`Fecha: ${fechaActual}`, 150, 26);
    doc.text(`Hora: ${horaActual}`, 150, 32);

    // Cabecera de datos del cliente estructurada correctamente con valores frescos
    doc.setFontSize(9);
    doc.text(`Cliente: ${infoCliente.empresa}`, 14, 40);
    doc.text(`Representante: ${infoCliente.representante}`, 14, 46);
    doc.text(`Mail: ${infoCliente.email}`, 14, 52);
    doc.text(`Teléfono Móvil: ${infoCliente.telefono}`, 14, 58);

    doc.setFontSize(16);
    doc.text("TRULINK FIBER LLC", 14, 70);
    doc.setFontSize(10);
    doc.text("5203 Juan Tabo Blvd NE, Ste 2b, Albuquerque, NM 87111", 14, 76);
    doc.text("Tel: +507 6640 3720", 14, 82);
    doc.text("www.trulinkfiber.com", 14, 88);

    const rows = carrito.map((item) => [
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

    doc.setFontSize(9);
    doc.text("Precios: EXW PANAMÁ", 14, finalY + 10);
    doc.text("NOTA: Esta cotización es válida por 15 días a partir de la fecha de emisión.", 14, finalY + 16);

    const textoFormaPago = "Forma de pago: 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.";
    const lineasFormaPago = doc.splitTextToSize(textoFormaPago, 180);
    doc.text(lineasFormaPago, 14, finalY + 22);

    const alturaBloquePago = lineasFormaPago.length * 5;
    const yMetodosPago = finalY + 22 + alturaBloquePago + 6;

    doc.text("MÉTODOS DE PAGO: YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES", 105, yMetodosPago, { align: "center" });

    try {
      const selloBase64 = await cargarImagenComoBase64("/images/firmaco.png");
      doc.addImage(selloBase64, "PNG", 160, yMetodosPago + 8, 32, 32);
    } catch (e) {
      console.error("No se pudo cargar el sello en el PDF:", e);
    }

    return doc;
  };

  const generarPDF = async () => {
    if (carrito.length === 0) {
      alert("La cotización está vacía.");
      return;
    }

    try {
      const infoCliente = await obtenerDatosClienteFresco();
      const doc = await crearInstanciaPDF(infoCliente);

      doc.save(`${referenciaActual}_TrulinkFiber.pdf`);

      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaActual}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      } else {
        const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
        const pdfPublicUrl = publicUrlData?.publicUrl || "";
        await guardarCotizacionEnSupabase(referenciaActual, pdfPublicUrl, infoCliente);
      }
    } catch (err: any) {
      console.error("Error al generar PDF:", err);
      alert(`Ocurrió un error al generar el PDF: ${err.message || err}`);
    }
  };

  const procesarPago = async () => {
    if (carrito.length === 0) {
      alert("La cotización está vacía. Por favor, agregue artículos.");
      return;
    }

    try {
      const infoCliente = await obtenerDatosClienteFresco();
      const doc = await crearInstanciaPDF(infoCliente);
      const pdfBlob = doc.output("blob");
      const fileName = `${referenciaActual}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        console.error("Error al subir PDF al bucket:", uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from("documentos").getPublicUrl(fileName);
      const pdfPublicUrl = publicUrlData?.publicUrl || "";

      await guardarCotizacionEnSupabase(referenciaActual, pdfPublicUrl, infoCliente);
      router.push(`/checkout?id=${referenciaActual}`);
    } catch (err: any) {
      console.error("ERROR INESPERADO:", err);
      alert(`Ocurrió un error al procesar la solicitud: ${err.message || err}`);
    }
  };

  const seleccionarCategoria = async (tabla: string) => {
    setBusqueda("");
    const { data, error } = await supabase.from(tabla).select("*");
    if (!error) {
      setProductos(data || []);
      setProductosFiltrados(data || []);
      setCategoria(tabla);
      setPaginaActual(1);
    } else {
      console.error("Error al consultar la tabla:", error);
    }
  };

  const indiceUltimoProducto = paginaActual * productosPorPagina;
  const indicePrimerProducto = indiceUltimoProducto - productosPorPagina;
  const productosActuales = productosFiltrados.slice(indicePrimerProducto, indiceUltimoProducto);
  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);

  return (
    <div style={{ backgroundColor: "#000", color: "#DAA520", minHeight: "100vh", padding: "50px 30px", fontFamily: "sans-serif" }}>
      <style jsx global>{`
        html, body {
          margin: 0;
          padding: 0;
          background-color: #000 !important;
          color: #DAA520;
        }
        .image-zoom { transition: transform 0.4s ease, box-shadow 0.4s ease; }
        .image-zoom:hover { transform: scale(1.06); box-shadow: 0 0 25px rgba(218, 165, 32, 0.4); cursor: pointer; }
        .card-item {
          background-color: #080808;
          border: 1px solid rgba(218, 165, 32, 0.3);
          border-radius: 12px;
          transition: all 0.3s ease;
        }
        .card-item:hover {
          border-color: #DAA520;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(218, 165, 32, 0.2);
          transform: translateY(-4px);
        }
        .custom-btn {
          background-color: transparent;
          color: #DAA520;
          border: 1px solid rgba(218, 165, 32, 0.5);
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.85rem;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .custom-btn:hover {
          background-color: #DAA520 !important;
          color: #000 !important;
          box-shadow: 0 0 15px rgba(218, 165, 32, 0.4);
        }
        .gold-btn {
          background-color: #DAA520;
          color: #000;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 0.9rem;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .gold-btn:hover {
          background-color: #f1c40f;
          box-shadow: 0 0 20px rgba(218, 165, 32, 0.5);
        }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid rgba(218, 165, 32, 0.3); padding: 12px; text-align: center; color: #FFF; font-size: 0.9rem; }
        th { background-color: #111; color: #DAA520; font-weight: 600; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", maxWidth: "1200px", margin: "0 auto 40px auto" }}>
        <button onClick={() => router.push("/portal-cliente")} className="custom-btn">
          ← Volver al Portal
        </button>
        <button
          onClick={() => document.getElementById("carrito-seccion")?.scrollIntoView({ behavior: "smooth" })}
          className="gold-btn"
          style={{ padding: "10px 20px", fontSize: "0.85rem" }}
        >
          🛒 Carrito ({totalItems})
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: "50px" }}>
        <img src="/images/logo.png" alt="Trulink Fiber Logo" style={{ width: "130px", marginBottom: "20px" }} />
        <h1 style={{ color: "#DAA520", fontSize: "1.6rem", fontWeight: "300", letterSpacing: "2px", textTransform: "uppercase", margin: 0 }}>
          {categoria ? `Base de Datos: ${categoria.toUpperCase()}` : "SELECCIONAR BASE DE DATOS DE PRODUCTOS"}
        </h1>
      </div>

      {!categoria ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px", maxWidth: "1000px", margin: "0 auto" }}>
          {[
            { name: "Accesorios", img: "/images/nap.png", tabla: "accesoriosdb" },
            { name: "Cables", img: "/images/patch.png", tabla: "cablesdb" },
            { name: "Herrajes", img: "/images/dtype.png", tabla: "herrajesdb" }
          ].map((cat, idx) => (
            <div
              key={idx}
              onClick={() => seleccionarCategoria(cat.tabla)}
              className="card-item"
              style={{ padding: "25px", textAlign: "center", cursor: "pointer" }}
            >
              <img src={cat.img} alt={cat.name} style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px", marginBottom: "20px", border: "1px solid rgba(218, 165, 32, 0.2)" }} />
              <h2 style={{ color: "#DAA520", fontSize: "1.2rem", fontWeight: "500", letterSpacing: "1px", margin: 0 }}>{cat.name}</h2>
              <span style={{ display: "block", marginTop: "10px", fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase" }}>Base: {cat.tabla}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "20px" }}>
            <button onClick={() => { setCategoria(null); setBusqueda(""); }} className="custom-btn">
              ← Volver a Selección de Bases de Datos
            </button>

            <div style={{ flex: 1, maxWidth: "400px", minWidth: "260px" }}>
              <input
                type="text"
                placeholder={`Buscar en ${categoria}...`}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: "100%", padding: "10px 15px", backgroundColor: "#080808", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.5)", borderRadius: "8px", outline: "none", fontSize: "0.9rem" }}
              />
            </div>
          </div>

          {productosFiltrados.length === 0 ? (
            <p style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.5)", fontSize: "1rem", fontStyle: "italic", marginTop: "50px" }}>
              No se encontraron productos coincidentes en esta tabla.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "25px" }}>
              {productosActuales.map((prod) => {
                const precioCalculado = getPrecioCliente(prod);
                return (
                  <div key={prod.SKU} className="card-item" style={{ padding: "20px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <img
                        src={prod.image_url || "/placeholder.png"}
                        alt={prod.Descripción}
                        className="image-zoom"
                        onClick={() => window.open(`/producto/${prod.SKU}`, "_blank")}
                        style={{ width: "100%", height: "160px", objectFit: "contain", borderRadius: "8px", marginBottom: "15px", backgroundColor: "#050505", padding: "10px", boxSizing: "border-box", border: "1px solid rgba(218, 165, 32, 0.15)" }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)", letterSpacing: "1px", display: "block", marginBottom: "5px" }}>{prod.SKU}</span>
                      <h3 style={{ fontSize: "0.95rem", color: "#DAA520", fontWeight: "500", height: "45px", overflow: "hidden", margin: "0 0 10px 0", lineHeight: "1.4" }}>{prod.Descripción}</h3>
                      <p style={{ fontSize: "1rem", color: "#FFF", fontWeight: "600", margin: "0 0 15px 0" }}>${precioCalculado.toFixed(2)}</p>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", justifyContent: "center" }}>
                      <input
                        type="number"
                        min="1"
                        value={cantidades[prod.SKU] || 1}
                        onChange={(e) => handleCantidadChange(prod.SKU, parseInt(e.target.value) || 1)}
                        style={{ width: "55px", padding: "8px", backgroundColor: "#050505", color: "#DAA520", border: "1px solid rgba(218, 165, 32, 0.4)", borderRadius: "6px", textAlign: "center", fontWeight: "bold" }}
                      />
                      <button
                        onClick={() => agregarAlCarrito(prod)}
                        className="gold-btn"
                        style={{ padding: "9px 16px", fontSize: "0.85rem", flex: 1 }}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "50px", alignItems: "center" }}>
              <button
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                className="custom-btn"
                style={{ opacity: paginaActual === 1 ? 0.4 : 1, cursor: paginaActual === 1 ? "not-allowed" : "pointer" }}
              >
                ⬅ Anterior
              </button>
              <span style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.9rem", letterSpacing: "1px" }}>
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                disabled={paginaActual === totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
                className="custom-btn"
                style={{ opacity: paginaActual === totalPaginas ? 0.4 : 1, cursor: paginaActual === totalPaginas ? "not-allowed" : "pointer" }}
              >
                Siguiente ➡
              </button>
            </div>
          )}
        </div>
      )}

      <div id="carrito-seccion" className="card-item" style={{ maxWidth: "900px", margin: "70px auto 0 auto", padding: "40px 35px", backgroundColor: "#080808" }}>
        <h2 style={{ textAlign: "center", color: "#DAA520", fontSize: "1.3rem", fontWeight: "500", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "30px" }}>
          Mi Cotización ({referenciaActual})
        </h2>
        {carrito.length === 0 ? (
          <p style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.5)", fontSize: "0.9rem", fontStyle: "italic" }}>El carrito está vacío.</p>
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
                    <td style={{ color: "rgba(255, 255, 255, 0.7)" }}>{item.SKU}</td>
                    <td style={{ textAlign: "left" }}>{item.nombre}</td>
                    <td>{item.cantidad}</td>
                    <td>${item.precio.toFixed(2)}</td>
                    <td style={{ color: "#DAA520", fontWeight: "600" }}>${(item.precio * item.cantidad).toFixed(2)}</td>
                    <td>
                      <button
                        onClick={() => eliminarDelCarrito(index)}
                        style={{ backgroundColor: "transparent", color: "#e74c3c", border: "1px solid rgba(231, 76, 60, 0.5)", borderRadius: "6px", cursor: "pointer", padding: "6px 12px", fontSize: "0.8rem", transition: "all 0.2s ease" }}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "25px", paddingRight: "5px" }}>
              <h2 style={{ color: "#DAA520", margin: 0, fontSize: "1.3rem", fontWeight: "600", letterSpacing: "1px" }}>TOTAL : ${totalCotizacion.toFixed(2)}</h2>
            </div>

            <div style={{ marginTop: "25px", color: "rgba(255, 255, 255, 0.7)", fontSize: "0.8rem", borderTop: "1px dashed rgba(218, 165, 32, 0.3)", paddingTop: "20px", lineHeight: "1.6" }}>
              <p style={{ margin: "4px 0" }}><strong>Precios:</strong> EXW PANAMÁ</p>
              <p style={{ margin: "4px 0" }}><strong>NOTA:</strong> Esta cotización es válida por 15 días a partir de la fecha de emisión.</p>
              <p style={{ margin: "4px 0" }}><strong>Forma de pago:</strong> 50% a la orden de compra o aceptacion de la oferta y 50% 3 dias antes de fecha estimada de finalizacion de produccion o preparacion de despacho.</p>
              <p style={{ margin: "4px 0" }}><strong>MÉTODOS DE PAGO:</strong> YAPPY, ACH, PAYPAL, TRANSFERENCIAS INTERNACIONALES</p>
            </div>

            <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "35px", flexWrap: "wrap" }}>
              <button onClick={generarPDF} className="gold-btn">GUARDAR PDF</button>
              <button onClick={procesarPago} className="gold-btn">Proceder con Pago</button>
            </div>
            <button
              onClick={vaciarCarrito}
              style={{ marginTop: "15px", width: "100%", backgroundColor: "transparent", color: "rgba(255, 255, 255, 0.5)", border: "1px solid rgba(255, 255, 255, 0.2)", padding: "10px", cursor: "pointer", borderRadius: "8px", fontSize: "0.85rem", transition: "all 0.2s ease" }}
            >
              Vaciar carrito
            </button>
          </>
        )}
      </div>
    </div>
  );
}