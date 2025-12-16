import * as cron from 'node-cron';
import { BackupService } from './backup.service.js';

export class CronService {
  private backupService: BackupService;
  private tasks: cron.ScheduledTask[] = [];

  constructor() {
    this.backupService = new BackupService();
  }

  /**
   * Inicia todos os agendamentos
   */
  start() {
    // Agendar backup a cada hora (na hora cheia)
    // Expressão cron: '0 * * * *' = minuto 0 de toda hora
    const backupTask = cron.schedule('0 * * * *', async () => {
      console.log('⏰ [Cron] Executando backup agendado...');
      const result = await this.backupService.realizarBackup(true);
      
      if (result.success) {
        console.log(`✅ [Cron] Backup realizado: ${result.backupPath}`);
        if (result.deletedCount > 0) {
          console.log(`🗑️  [Cron] Backups antigos removidos: ${result.deletedCount}`);
        }
      } else {
        console.error(`❌ [Cron] Erro no backup: ${result.error}`);
      }
    }, {
      scheduled: true,
      timezone: 'America/Sao_Paulo', // Timezone brasileiro
    });

    this.tasks.push(backupTask);

    // Fazer backup imediato ao iniciar (opcional)
    // Descomente se quiser backup na inicialização
    // this.backupService.realizarBackup(true).then(result => {
    //   if (result.success) {
    //     console.log('✅ Backup inicial realizado');
    //   }
    // });

    console.log('⏰ Sistema de agendamento iniciado');
    console.log('   📅 Backup agendado: A cada hora (na hora cheia)');
  }

  /**
   * Para todos os agendamentos
   */
  stop() {
    this.tasks.forEach(task => task.stop());
    this.tasks = [];
    console.log('⏰ Sistema de agendamento parado');
  }
}

