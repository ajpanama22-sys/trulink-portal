import { useState } from "react";

export default function InversoresPage() {
  const [formData, setFormData] = useState({
    nombre_fondo: "",
    website: "",
    representante: "",
    cargo: "",
    correo: "",
    telefono: "",
    nda: null as File | null,
    identificacion: null as File | null,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 🚀 Aquí luego conectamos con Supabase:
    // 1. Subir NDA e identificación a Supabase Storage
    // 2. Insertar registro en tabla solicitudes_acceso
    alert("Solicitud enviada. Nuestro equipo revisará tu NDA.");
  };

  return (
    <div style={{ padding: "2rem", backgroundColor: "#000", color: "#FFD700" }}>
      <h1>Portal de Inversores Estratégicos</h1>
      <p>Bienvenido al área de registro de inversores.</p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "20px" }}
      >
        <input type="text" name="nombre_fondo" placeholder="Nombre del Fondo / Family Office" onChange={handleChange} required />
        <input type="url" name="website" placeholder="Sitio Web Corporativo" onChange={handleChange} required />
        <input type="text" name="representante" placeholder="Nombre del Representante" onChange={handleChange} required />
        <input type="text" name="cargo" placeholder="Cargo" onChange={handleChange} required />
        <input type="email" name="correo" placeholder="Correo Corporativo" onChange={handleChange} required />
        <input type="tel" name="telefono" placeholder="Teléfono" onChange={handleChange} required />

        <label>
          Subir NDA (PDF):
          <input type="file" name="nda" accept="application/pdf" onChange={handleChange} required />
        </label>
        <label>
          Subir Identificación Oficial (PDF):
          <input type="file" name="identificacion" accept="application/pdf" onChange={handleChange} required />
        </label>

        <button type="submit" style={{ backgroundColor: "#FFD700", color: "#000", padding: "0.5rem", fontWeight: "bold" }}>
          Enviar Solicitud
        </button>
      </form>
    </div>
  );
}
