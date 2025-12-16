import { copyFile, readdir, stat, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import os from 'os';

export class BackupService {
  private sourceDb: string;
  private destDir: string;
  private retentionDays: number;

  constructor() {
    // Obter caminhos
    const BACKUP_DIR_ENV = process.env.BACKUP_DIR;
    const DEFAULT_BACKUP_DIR = join(os.homedir(), 'OneDrive', 'Backups_CondeFlow');
    
    this.sourceDb = join(process.cwd(), 'prisma', 'dev.db');
    this.destDir = BACKUP_DIR_ENV || DEFAULT_BACKUP_DIR;
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);
  }

  /**
   * Formata data para nome de arquivo
   */
  private formatDateForFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `backup-${year}-${month}-${day}-${hours}-${minutes}.db`;
  }

  /**
   * Verifica se o arquivo é mais antigo que X dias
   */
  private isOlderThanDays(fileDate: Date, days: number): boolean {
    const now = new Date();
    const diffTime = now.getTime() - fileDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays > days;
  }

  /**
   * Cria o diretório de backup se não existir
   */
  private async ensureBackupDir(): Promise<void> {
    if (!existsSync(this.destDir)) {
      await mkdir(this.destDir, { recursive: true });
      console.log(`📁 Diretório de backup criado: ${this.destDir}`);
    }
  }

  /**
   * Copia o banco de dados para o destino
   */
  private async copyDatabase(): Promise<string> {
    // Verificar se o arquivo fonte existe
    if (!existsSync(this.sourceDb)) {
      throw new Error(`Arquivo de banco de dados não encontrado: ${this.sourceDb}`);
    }

    // Gerar nome do arquivo de backup
    const now = new Date();
    const filename = this.formatDateForFilename(now);
    const destPath = join(this.destDir, filename);

    // Copiar arquivo
    // Para SQLite em modo WAL, a cópia simples funciona bem
    await copyFile(this.sourceDb, destPath);

    return destPath;
  }

  /**
   * Remove backups antigos
   */
  private async cleanupOldBackups(): Promise<number> {
    let deletedCount = 0;

    try {
      const files = await readdir(this.destDir);
      
      for (const file of files) {
        // Verificar se é um arquivo de backup (começa com "backup-" e termina com ".db")
        if (file.startsWith('backup-') && file.endsWith('.db')) {
          const filePath = join(this.destDir, file);
          const fileStats = await stat(filePath);
          const fileDate = fileStats.mtime;

          if (this.isOlderThanDays(fileDate, this.retentionDays)) {
            await unlink(filePath);
            deletedCount++;
            console.log(`  🗑️  Removido: ${file} (${Math.round((Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24))} dias)`);
          }
        }
      }
    } catch (error: any) {
      // Se não conseguir listar arquivos, apenas loga o erro mas não falha
      console.warn(`⚠️  Aviso ao limpar backups antigos: ${error.message}`);
    }

    return deletedCount;
  }

  /**
   * Realiza o backup completo do banco de dados
   * @param silent Se true, não imprime logs (útil para execução automática)
   * @returns Objeto com informações do backup realizado
   */
  async realizarBackup(silent: boolean = false): Promise<{
    success: boolean;
    backupPath?: string;
    deletedCount: number;
    error?: string;
  }> {
    if (!silent) {
      console.log('🔄 Iniciando backup do banco de dados...');
      console.log(`📂 Origem: ${this.sourceDb}`);
      console.log(`📂 Destino: ${this.destDir}`);
      console.log(`⏰ Retenção: ${this.retentionDays} dias\n`);
    }

    try {
      // Garantir que o diretório de backup existe
      await this.ensureBackupDir();

      // Copiar banco de dados
      const backupPath = await this.copyDatabase();
      if (!silent) {
        console.log(`✅ Backup realizado: ${backupPath}`);
      }

      // Limpar backups antigos
      const deletedCount = await this.cleanupOldBackups();
      
      if (!silent) {
        if (deletedCount > 0) {
          console.log(`\n🗑️  Backups antigos removidos: ${deletedCount}`);
        } else {
          console.log(`\n✨ Nenhum backup antigo para remover`);
        }
        console.log('\n✅ Processo de backup concluído com sucesso!');
      }

      return {
        success: true,
        backupPath,
        deletedCount,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Erro desconhecido';
      
      if (!silent) {
        console.error('\n❌ Erro ao realizar backup:', errorMessage);
        console.error(error.stack);
      }

      return {
        success: false,
        deletedCount: 0,
        error: errorMessage,
      };
    }
  }
}

