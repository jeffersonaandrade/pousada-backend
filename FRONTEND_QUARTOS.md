# 📋 Implementação da Tela de Gestão de Quartos

Este documento contém o código completo para implementar a tela de gestão de quartos no frontend React.

## 📁 Estrutura de Arquivos

```
web-admin/
├── src/
│   ├── pages/
│   │   └── Quartos.tsx          # Nova página de gestão de quartos
│   ├── services/
│   │   └── api/
│   │       └── quartos.ts      # Serviço de API para quartos
│   ├── components/
│   │   ├── Modal.tsx           # Componente de modal reutilizável (se não existir)
│   │   └── Toast.tsx           # Componente de toast (se não existir)
│   └── App.tsx                 # Adicionar rota /quartos
```

## 🔌 Serviço de API (src/services/api/quartos.ts)

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Quarto {
  id: number;
  numero: string;
  andar: number;
  categoria: string;
  status: 'LIVRE' | 'OCUPADO' | 'LIMPEZA' | 'MANUTENCAO';
  hospedes?: Array<{
    id: number;
    nome: string;
    tipo: string;
  }>;
}

export interface CriarQuartoData {
  numero: string;
  andar: number;
  categoria: string;
}

export interface AtualizarQuartoData {
  numero?: string;
  categoria?: string;
  andar?: number;
}

export const quartosApi = {
  async listar(): Promise<Quarto[]> {
    const response = await fetch(`${API_BASE_URL}/quartos`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao listar quartos');
    }
    return data.data;
  },

  async buscar(id: number): Promise<Quarto> {
    const response = await fetch(`${API_BASE_URL}/quartos/${id}`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao buscar quarto');
    }
    return data.data;
  },

  async criar(dados: CriarQuartoData): Promise<Quarto> {
    const response = await fetch(`${API_BASE_URL}/quartos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dados),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao criar quarto');
    }
    return data.data;
  },

  async atualizar(id: number, dados: AtualizarQuartoData): Promise<Quarto> {
    const response = await fetch(`${API_BASE_URL}/quartos/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dados),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao atualizar quarto');
    }
    return data.data;
  },

  async deletar(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/quartos/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao deletar quarto');
    }
  },

  async atualizarStatus(id: number, status: string): Promise<Quarto> {
    const response = await fetch(`${API_BASE_URL}/quartos/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Erro ao atualizar status');
    }
    return data.data;
  },
};
```

## 📄 Página Quartos.tsx

Veja o arquivo `QUARTOS_PAGE.tsx` neste diretório para o código completo.

## 🔗 Integração no App.tsx

Adicione a rota no seu `App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Quartos from './pages/Quartos';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... outras rotas ... */}
        <Route path="/quartos" element={<Quartos />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## 📋 Adicionar no Menu Lateral (Sidebar)

Adicione o item no menu:

```typescript
<Link to="/quartos" className="flex items-center gap-2 p-2 rounded hover:bg-gray-100">
  <HomeIcon className="w-5 h-5" />
  <span>Quartos</span>
</Link>
```

## ✅ Checklist de Implementação

- [ ] Criar arquivo `src/services/api/quartos.ts`
- [ ] Criar arquivo `src/pages/Quartos.tsx`
- [ ] Adicionar rota `/quartos` no `App.tsx`
- [ ] Adicionar item "Quartos" no menu lateral
- [ ] Testar criação de quarto
- [ ] Testar edição de quarto
- [ ] Testar exclusão de quarto
- [ ] Testar atualização de status

