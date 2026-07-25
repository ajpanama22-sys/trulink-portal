import { useState } from "react";
import { useRouter } from "next/router";
import { getSupabase } from "../../lib/supabaseClient"; // Ajusta la ruta a tu cliente de Supabase si es necesario

export default function CrearPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCrearPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Las contraseñas no coinciden");
      return;
    }
    if (!token) {
      alert("Token no válido o ausente");
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Aquí buscas al cliente que tenga ese token pendiente y actualizas su contraseña/estado
    // Dependiendo de cómo manejes la autenticación (Supabase Auth o tabla de clientes propia):
    try {
      // Ejemplo actualizando la tabla clientes basada en el password_token
      const { error } = await supabase
        .from("clientes")
        .update({ 
          status: 'activo', 
          password_token: null // Limpiamos el token para que no se reuse
          // Si usas Supabase Auth, aquí harías el registro o actualización correspondiente
        })
        .eq("password_token", token);

      if (error) throw error;

      alert("¡Contraseña creada con éxito! Ahora puedes iniciar sesión.");
      router.push("/portal-cliente"); // O la ruta de login de tu portal
    } catch (err: any) {
      alert("Error al guardar la contraseña: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#080808", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", color: "#E0E0E0", fontFamily: "sans-serif" }}>
      <form onSubmit={handleCrearPassword} style={{ background: "#111", border: "1px solid rgba(218, 165, 32, 0.3)", padding: "40px", borderRadius: "12px", width: "100%", maxWidth: "400px", boxSizing: "border-box" }}>
        <h2 style={{ color: "#DAA520", marginBottom: "20px", fontSize: "1.5rem", textAlign: "center" }}>CREAR CONTRASEÑA</h2>
        
        <div style={{ marginBottom: "15px", display: "flex", flexDirection: "column", gap: "5px" }}>
          <label style={{ fontSize: "0.8rem", color: "#AAA" }}>Nueva Contraseña</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#FFF", padding: "10px", borderRadius: "6px", outline: "none" }}
          />
        </div>

        <div style={{ marginBottom: "25px", display: "flex", flexDirection: "column", gap: "5px" }}>
          <label style={{ fontSize: "0.8rem", color: "#AAA" }}>Confirmar Contraseña</label>
          <input 
            type="password" 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
            required
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#FFF", padding: "10px", borderRadius: "6px", outline: "none" }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ width: "100%", background: "#DAA520", color: "#000", border: "none", padding: "12px", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
        >
          {loading ? "Guardando..." : "Guardar Contraseña"}
        </button>
      </form>
    </div>
  );
}