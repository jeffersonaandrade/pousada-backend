import { BackupService } from '../src/services/backup.service.js';

/**
 * Script manual de backup
 * Agora usa o BackupService para manter a lógica centralizada
 */
async function main() {
  const backupService = new BackupService();
  const result = await backupService.realizarBackup(false);

  if (result.success) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Executar
main();
