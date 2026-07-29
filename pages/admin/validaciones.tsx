const cargarSolicitudes = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Consulta robusta por exclusión: Trae todo lo que NO esté aprobado ni rechazado.
    // De esta manera capturamos nulos, vacíos, 'pendiente', 'PENDIENTE', etc. de forma segura.
    const { data, error } = await supabase
      .from("solicitudes_acceso")
      .select("*")
      .not("status", "in", '("aprobado","APROBADO","rechazado","RECHAZADO")');
      
    if (error) {
      console.error("Error al cargar solicitudes:", error);
    } else {
      // Filtro de seguridad adicional en el cliente por si acaso
      const pendientesLimpias = (data || []).filter(item => {
        const s = (item.status || "").trim().toLowerCase();
        return s === "" || s === "pendiente" || s === "pending";
      });

      setDataList(pendientesLimpias);
      
      const initialPagos: { [key: string]: { tipo: string; porcentaje: number } } = {};
      pendientesLimpias.forEach((item: any) => {
        initialPagos[item.id] = { tipo: "50%", porcentaje: 50 };
      });
      setFormasPago(initialPagos);
    }
    setLoading(false);
  };