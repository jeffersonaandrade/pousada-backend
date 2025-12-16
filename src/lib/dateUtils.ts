/**
 * Utilitários para manipulação de datas no timezone brasileiro (America/Sao_Paulo)
 * Importante para fins legais e contestação de compras
 */

/**
 * Retorna a data/hora atual no timezone brasileiro (America/Sao_Paulo - UTC-3)
 * A data é salva no banco representando o horário brasileiro, importante para fins legais
 * @returns Date representando o horário brasileiro atual
 */
export function getDataHoraBrasil(): Date {
  const agora = new Date();
  
  // Obter a data/hora atual no timezone brasileiro usando Intl API
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Obter partes da data formatada no timezone brasileiro
  const partes = formatter.formatToParts(agora);
  const ano = parseInt(partes.find(p => p.type === 'year')?.value || '0');
  const mes = parseInt(partes.find(p => p.type === 'month')?.value || '0') - 1; // mês é 0-indexed
  const dia = parseInt(partes.find(p => p.type === 'day')?.value || '0');
  const hora = parseInt(partes.find(p => p.type === 'hour')?.value || '0');
  const minuto = parseInt(partes.find(p => p.type === 'minute')?.value || '0');
  const segundo = parseInt(partes.find(p => p.type === 'second')?.value || '0');
  const milissegundo = agora.getMilliseconds();
  
  // Criar a data usando os valores do Brasil
  // Como queremos que a data salva represente o horário brasileiro quando lida,
  // precisamos ajustar: o Brasil está UTC-3, então se são 23:00 no Brasil,
  // precisamos criar uma data UTC que seja 02:00 do dia seguinte (23:00 + 3h = 02:00)
  // Assim, quando essa data for lida no timezone brasileiro, mostrará 23:00
  
  // Criar a data UTC adicionando 3 horas aos valores do Brasil
  const dataBrasil = new Date(Date.UTC(ano, mes, dia, hora, minuto, segundo, milissegundo));
  
  // Adicionar 3 horas para compensar o offset do Brasil (UTC-3)
  // Isso fará com que quando lida no timezone brasileiro, mostre o horário correto
  const dataAjustada = new Date(dataBrasil.getTime() + (3 * 60 * 60 * 1000));
  
  return dataAjustada;
}

/**
 * Formata uma data para exibição no formato brasileiro
 * @param data Data a ser formatada
 * @returns String formatada: "DD/MM/YYYY HH:mm:ss"
 */
export function formatarDataHoraBrasil(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(data);
}

/**
 * Converte uma data UTC para o timezone brasileiro
 * @param dataUTC Data em UTC
 * @returns Date ajustada para o timezone brasileiro
 */
export function converterParaBrasil(dataUTC: Date): Date {
  // Calcular offset do timezone brasileiro
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
  
  // Obter a diferença entre UTC e o timezone brasileiro
  const offsetBrasil = -3 * 60; // UTC-3 em minutos (aproximado)
  const offsetAtual = dataUTC.getTimezoneOffset();
  const diferenca = offsetBrasil - offsetAtual;
  
  return new Date(dataUTC.getTime() - (diferenca * 60 * 1000));
}

