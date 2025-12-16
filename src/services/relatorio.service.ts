import { prisma } from '../lib/prisma.js';
import ExcelJS from 'exceljs';

export class RelatorioService {
  /**
   * Gera relatório de vendas em Excel
   * @param dataInicio Data de início (opcional)
   * @param dataFim Data de fim (opcional)
   * @returns Buffer do arquivo Excel
   */
  async gerarRelatorioVendasExcel(dataInicio?: string, dataFim?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    
    // Configurar filtro de data
    const where: any = {
      status: { not: 'CANCELADO' },
    };

    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) {
        const inicio = new Date(dataInicio + 'T00:00:00');
        where.data.gte = inicio;
      }
      if (dataFim) {
        const fim = new Date(dataFim + 'T23:59:59');
        fim.setHours(23, 59, 59, 999);
        where.data.lte = fim;
      }
    }

    // ===== ABA 1: Vendas do Dia =====
    const vendasSheet = workbook.addWorksheet('Vendas do Dia');
    vendasSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Data/Hora', key: 'data', width: 20 },
      { header: 'Hóspede', key: 'hospede', width: 30 },
      { header: 'Produto', key: 'produto', width: 30 },
      { header: 'Quantidade', key: 'quantidade', width: 12 },
      { header: 'Valor Unit.', key: 'valorUnit', width: 15 },
      { header: 'Valor Total', key: 'valorTotal', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Método', key: 'metodo', width: 12 },
    ];

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        hospede: true,
        produto: true,
      },
      orderBy: { data: 'desc' },
    });

    // Agrupar pedidos por produto para calcular quantidade
    const pedidosAgrupados = new Map<string, {
      id: number;
      data: Date;
      hospede: string;
      produto: string;
      quantidade: number;
      valorUnit: number;
      valorTotal: number;
      status: string;
      metodo: string;
    }>();

    pedidos.forEach((pedido) => {
      const key = `${pedido.hospedeId}-${pedido.produtoId}-${pedido.status}`;
      const existente = pedidosAgrupados.get(key);
      
      if (existente) {
        existente.quantidade += 1;
        existente.valorTotal += pedido.valor;
      } else {
        pedidosAgrupados.set(key, {
          id: pedido.id,
          data: pedido.data,
          hospede: pedido.hospede.nome,
          produto: pedido.produto.nome,
          quantidade: 1,
          valorUnit: pedido.valor,
          valorTotal: pedido.valor,
          status: pedido.status,
          metodo: pedido.metodoCriacao,
        });
      }
    });

    pedidosAgrupados.forEach((venda) => {
      vendasSheet.addRow({
        id: venda.id,
        data: venda.data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        hospede: venda.hospede,
        produto: venda.produto,
        quantidade: venda.quantidade,
        valorUnit: `R$ ${venda.valorUnit.toFixed(2)}`,
        valorTotal: `R$ ${venda.valorTotal.toFixed(2)}`,
        status: venda.status,
        metodo: venda.metodo,
      });
    });

    // Formatar cabeçalho
    vendasSheet.getRow(1).font = { bold: true };
    vendasSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // ===== ABA 2: Por Garçom =====
    const garcomSheet = workbook.addWorksheet('Por Garçom');
    garcomSheet.columns = [
      { header: 'Garçom', key: 'garcom', width: 30 },
      { header: 'Total Pedidos', key: 'totalPedidos', width: 15 },
      { header: 'Valor Total', key: 'valorTotal', width: 15 },
    ];

    // Buscar pedidos manuais (que têm gerenteId)
    const pedidosManuais = await prisma.pedido.findMany({
      where: {
        ...where,
        metodoCriacao: 'MANUAL',
        gerenteId: { not: null },
      },
      include: {
        gerente: true,
      },
    });

    // Agrupar por garçom
    const porGarcom = new Map<string, { totalPedidos: number; valorTotal: number }>();
    
    pedidosManuais.forEach((pedido) => {
      if (pedido.gerente) {
        const nome = pedido.gerente.nome;
        const existente = porGarcom.get(nome) || { totalPedidos: 0, valorTotal: 0 };
        existente.totalPedidos += 1;
        existente.valorTotal += pedido.valor;
        porGarcom.set(nome, existente);
      }
    });

    porGarcom.forEach((stats, nome) => {
      garcomSheet.addRow({
        garcom: nome,
        totalPedidos: stats.totalPedidos,
        valorTotal: `R$ ${stats.valorTotal.toFixed(2)}`,
      });
    });

    garcomSheet.getRow(1).font = { bold: true };
    garcomSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // ===== ABA 3: Itens Mais Vendidos =====
    const itensSheet = workbook.addWorksheet('Itens Mais Vendidos');
    itensSheet.columns = [
      { header: 'Produto', key: 'produto', width: 30 },
      { header: 'Quantidade', key: 'quantidade', width: 15 },
      { header: 'Valor Total', key: 'valorTotal', width: 15 },
    ];

    // Agrupar por produto
    const porProduto = new Map<string, { quantidade: number; valorTotal: number }>();
    
    pedidos.forEach((pedido) => {
      const nome = pedido.produto.nome;
      const existente = porProduto.get(nome) || { quantidade: 0, valorTotal: 0 };
      existente.quantidade += 1;
      existente.valorTotal += pedido.valor;
      porProduto.set(nome, existente);
    });

    // Ordenar por quantidade (mais vendidos primeiro)
    const itensOrdenados = Array.from(porProduto.entries())
      .map(([nome, stats]) => ({ nome, ...stats }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 20); // Top 20

    itensOrdenados.forEach((item) => {
      itensSheet.addRow({
        produto: item.nome,
        quantidade: item.quantidade,
        valorTotal: `R$ ${item.valorTotal.toFixed(2)}`,
      });
    });

    itensSheet.getRow(1).font = { bold: true };
    itensSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Gerar buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

