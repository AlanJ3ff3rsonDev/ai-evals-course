# AI Evals for Engineers & PMs - Site do Curso

Um site moderno e interativo para o curso completo de avaliação de sistemas de IA, organizado por módulos e com sistema de acompanhamento de progresso.

## 🚀 Como Usar

### 1. Abrir o Site
- Abra o arquivo `index.html` em qualquer navegador moderno
- O site funciona offline, não precisa de servidor

### 2. Navegar pelo Curso
- **Sidebar Esquerda**: Lista todos os módulos e aulas
- **Clique nos módulos** para expandir/colapsar
- **Clique nas aulas** para carregar o conteúdo
- **Barra de progresso** mostra seu avanço geral

### 3. Estudar as Aulas
- **Conteúdo**: Carregado automaticamente dos arquivos Markdown
- **Navegação**: Use os botões "Anterior" e "Próximo"
- **Marcar como concluído**: Clique no botão para acompanhar seu progresso

### 4. Acompanhar Progresso
- **Progresso geral**: Barra no topo da sidebar
- **Progresso por módulo**: Mostrado como "X/Y" aulas concluídas
- **Aulas concluídas**: Marcadas com ✓ verde
- **Progresso salvo**: Automaticamente no navegador

## 📚 Estrutura do Curso

### Módulo 1: Fundamentos de Avaliação
- O que é Avaliação?
- Três Abismos do Desenvolvimento
- Por que a Avaliação é Desafiadora?
- Ciclo de Vida da Avaliação
- Resumo

### Módulo 2: Compreendendo LLMs
- Pontos Fortes e Fracos
- Fundamentos de Prompting
- Definindo Métricas de Avaliação
- Avaliações Centradas em Fundação vs Aplicação
- Elicitando Labels para Métricas
- Resumo
- Glossário de Termos
- Exercícios

### Módulo 3: Análise de Erros
- Bootstrap de Dataset Inicial
- Codificação Aberta: Ler e Rotular Traços
- Codificação Axial: Estruturar e Mesclar Modos de Falha
- Rotulando Traços Após Estruturar Modos de Falha
- Iteração e Refinamento da Taxonomia de Falhas
- Armadilhas Comuns
- Resumo da Análise de Erros
- Exercícios

### Módulo 4: Avaliação Colaborativa
- Ditadores Benevolentes às Vezes são Preferíveis
- Um Fluxo de Trabalho de Anotação Colaborativa
- Medindo Concordância Inter-Anotador
- Facilitando Sessões de Alinhamento e Resolvendo Desacordos
- Conectando Labels Colaborativos a Avaliadores Automatizados
- Armadilhas Comuns na Avaliação Colaborativa
- Resumo
- Exercícios

### Módulo 5: Métricas e Avaliação
- Definindo as Métricas Certas
- Implementando Métricas
- LLM como Juiz: Prompts
- Divisões de Dados e LLM como Juiz
- Refinamento Iterativo de Prompts
- Sucesso Real com Juízes Imperfeitos
- Estimativa de Taxa de Sucesso em Python
- Métricas por Grupo
- Armadilhas Comuns
- Resumo

### Módulo 6: Avaliação Multi-Turn
- Visão Geral
- Estratégias Práticas
- Avaliação Automatizada
- Armadilhas
- Resumo

### Módulo 7: Avaliação RAG
- Visão Geral
- Pares de Consulta-Resposta Sintéticos
- Métricas de Recuperação
- Qualidade de Geração
- Armadilhas Comuns
- Resumo
- Exercícios

### Módulo 8: Sistemas Agênticos
- Chamada de Ferramentas
- Sistemas Agênticos
- Debugging de Pipelines Multi-Etapa
- Modalidades
- Armadilhas Comuns
- Resumo

### Módulo 9: Produção e Monitoramento
- CI como Rede de Segurança
- CD e Monitoramento Online
- Roda de Melhoria Contínua
- Armadilhas Práticas na Avaliação de Produção
- Resumo

## ✨ Funcionalidades

- **Interface Responsiva**: Funciona em desktop, tablet e mobile
- **Navegação Intuitiva**: Módulos expansíveis, navegação entre aulas
- **Sistema de Progresso**: Acompanha aulas concluídas
- **Persistência Local**: Progresso salvo no navegador
- **Design Moderno**: Interface limpa e profissional
- **Markdown Renderizado**: Conteúdo formatado automaticamente

## 🛠️ Tecnologias

- **HTML5**: Estrutura semântica
- **CSS3**: Estilos modernos com Flexbox e Grid
- **JavaScript ES6+**: Funcionalidades interativas
- **Font Awesome**: Ícones
- **Google Fonts**: Tipografia Inter

## 📱 Responsividade

- **Desktop**: Sidebar fixa, layout otimizado
- **Tablet**: Sidebar colapsável
- **Mobile**: Layout adaptado para telas pequenas

## 💾 Armazenamento

- **LocalStorage**: Progresso salvo localmente
- **Sem servidor**: Funciona completamente offline
- **Dados privados**: Só você tem acesso ao seu progresso

## 🔧 Personalização

### Cores e Estilos
- Edite `styles.css` para mudar cores, fontes e layout
- Gradientes e cores principais no início do arquivo

### Estrutura do Curso
- Modifique `script.js` na seção `courseStructure`
- Adicione/remova módulos e aulas conforme necessário

### Conteúdo
- Substitua os arquivos `.md` na pasta `content/`
- Mantenha o formato Markdown para renderização automática

## 🚀 Deploy

### Opção 1: Local
- Abra `index.html` diretamente no navegador
- Funciona offline, sem necessidade de servidor

### Opção 2: Servidor Web
- Faça upload para qualquer servidor web
- GitHub Pages, Netlify, Vercel, etc.
- Funciona com qualquer servidor estático

### Opção 3: Docker
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
```

## 📝 Licença

Este projeto é parte do curso "AI Evals for Engineers & PMs" e está disponível para uso educacional.

## 🤝 Contribuições

Para melhorar o site:
1. Edite os arquivos HTML, CSS ou JavaScript
2. Teste as mudanças localmente
3. Mantenha a responsividade e acessibilidade

## 📞 Suporte

- **Problemas técnicos**: Verifique o console do navegador
- **Conteúdo do curso**: Consulte os arquivos Markdown originais
- **Funcionalidades**: O código está bem comentado para facilitar modificações

---

**Bom estudo!** 🎓✨
