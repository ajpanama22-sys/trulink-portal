import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { verificarSesionAdmin } from '../../../lib/verificarSesionAdmin';

const ROLES_PERMITIDOS = ["Super Administrador", "Administrador"];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const auth = await verificarSesionAdmin(req, ROLES_PERMITIDOS);
  if (!auth.autorizado) {
    return res.status(auth.status).json({ error: auth.mensaje });
  }

  try {
    const { data: clientes, error: errClientes } = await supabase
      .from('clientes')
      .select('id, razon_social, email, tipo_cliente, price_list, pais, perfil_cliente, industria, status, created_at');
    if (errClientes) throw errClientes;

    const { data: quotes, error: errQuotes } = await supabase
      .from('quotes')
      .select('client_id, total, status, estado_pago, pagado_total, created_at');
    if (errQuotes) throw errQuotes;

    const { data: cxc, error: errCxc } = await supabase
      .from('cuentas_por_cobrar')
      .select('cliente_id, monto_total, saldo_pendiente, estado, fecha_vencimiento');
    if (errCxc) throw errCxc;

    const hoy = new Date();

    const resumen = (clientes || []).map((c) => {
      const comprasCliente = (quotes || []).filter(
        (q) =>
          q.client_id === c.id &&
          (q.pagado_total === true || q.estado_pago === 'pagado' || q.status === 'aceptada')
      );
      const totalComprado = comprasCliente.reduce((sum, q) => sum + (Number(q.total) || 0), 0);

      const cxcCliente = (cxc || []).filter((f) => f.cliente_id === c.id);
      const saldoPendiente = cxcCliente.reduce((sum, f) => sum + (Number(f.saldo_pendiente) || 0), 0);
      const atrasadas = cxcCliente.filter(
        (f) => f.estado !== 'pagado' && f.fecha_vencimiento && new Date(f.fecha_vencimiento) < hoy
      );
      const montoAtrasado = atrasadas.reduce((sum, f) => sum + (Number(f.saldo_pendiente) || 0), 0);

      return {
        id: c.id,
        razon_social: c.razon_social,
        email: c.email,
        pais: c.pais || 'Sin especificar',
        tipo_cliente: c.tipo_cliente || 'Sin especificar',
        perfil_cliente: c.perfil_cliente || 'Sin especificar',
        price_list: c.price_list || 'Sin especificar',
        industria: c.industria || 'Sin especificar',
        status: c.status,
        totalComprado,
        cantidadCompras: comprasCliente.length,
        saldoPendiente,
        montoAtrasado,
        facturasAtrasadas: atrasadas.length,
      };
    });

    return res.status(200).json({ clientes: resumen });
  } catch (err: any) {
    console.error('Error en segmentacion-clientes:', err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}