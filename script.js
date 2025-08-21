// Estrutura do curso organizada por módulos
const courseStructure = {
    modules: [
        {
            id: 'module-1',
            title: 'Fundamentos de Avaliação',
            icon: 'fas fa-lightbulb',
            lessons: [
                { id: 'lesson-1.1', title: 'O que é Avaliação?', file: 'content/lesson-1.1-what-is-evaluation.md' },
                { id: 'lesson-1.2', title: 'Três Abismos do Desenvolvimento', file: 'content/lesson-1.2-three-gulfs-of-llm-pipeline-development.md' },
                { id: 'lesson-1.3', title: 'Por que a Avaliação é Desafiadora?', file: 'content/lesson-1.3-why-llm-pipeline-evaluation-is-challenging.md' },
                { id: 'lesson-1.4', title: 'Ciclo de Vida da Avaliação', file: 'content/lesson-1.4-llm-evaluation-lifecycle.md' },
                { id: 'lesson-1.5', title: 'Resumo', file: 'content/lesson-1.5-summary.md' }
            ]
        },
        {
            id: 'module-2',
            title: 'Compreendendo LLMs',
            icon: 'fas fa-brain',
            lessons: [
                { id: 'lesson-2.1', title: 'Pontos Fortes e Fracos', file: 'content/lesson-2.1-strengths-and-weaknesses-of-llms.md' },
                { id: 'lesson-2.2', title: 'Fundamentos de Prompting', file: 'content/lesson-2.2-prompting-fundamentals.md' },
                { id: 'lesson-2.3', title: 'Definindo Métricas de Avaliação', file: 'content/lesson-2.3-defining-good-types-of-evaluation-metrics.md' },
                { id: 'lesson-2.4', title: 'Avaliações Centradas em Fundação vs Aplicação', file: 'content/lesson-2.4-foundation-vs-application-centric-evals.md' },
                { id: 'lesson-2.5', title: 'Elicitando Labels para Métricas', file: 'content/lesson-2.5-eliciting-labels-for-metric-computation.md' },
                { id: 'lesson-2.6', title: 'Resumo', file: 'content/lesson-2.6-summary.md' },
                { id: 'lesson-2.7', title: 'Glossário de Termos', file: 'content/lesson-2.7-glossary-of-terms.md' },
                { id: 'lesson-2.8', title: 'Exercícios', file: 'content/lesson-2.8-exercises.md' }
            ]
        },
        {
            id: 'module-3',
            title: 'Análise de Erros',
            icon: 'fas fa-search',
            lessons: [
                { id: 'lesson-3.1', title: 'Bootstrap de Dataset Inicial', file: 'content/lesson-3.1-bootstrap-a-starting-dataset.md' },
                { id: 'lesson-3.2', title: 'Codificação Aberta: Ler e Rotular Traços', file: 'content/lesson-3.2-open-coding-read-and-label-traces.md' },
                { id: 'lesson-3.3', title: 'Codificação Axial: Estruturar e Mesclar Modos de Falha', file: 'content/lesson-3.3-axial-coding-structuring-and-merging-failure-modes.md' },
                { id: 'lesson-3.4', title: 'Rotulando Traços Após Estruturar Modos de Falha', file: 'content/lesson-3.4-labeling-traces-after-structuring-failure-modes.md' },
                { id: 'lesson-3.5', title: 'Iteração e Refinamento da Taxonomia de Falhas', file: 'content/lesson-3.5-iteration-and-refining-the-failure-taxonomy.md' },
                { id: 'lesson-3.6', title: 'Armadilhas Comuns', file: 'content/lesson-3.6-common-pitfalls.md' },
                { id: 'lesson-3.7', title: 'Resumo da Análise de Erros', file: 'content/lesson-3.7-summary-of-error-analysis.md' },
                { id: 'lesson-3.8', title: 'Exercícios', file: 'content/lesson-3.8-exercises.md' }
            ]
        },
        {
            id: 'module-4',
            title: 'Avaliação Colaborativa',
            icon: 'fas fa-users',
            lessons: [
                { id: 'lesson-4.1', title: 'Ditadores Benevolentes às Vezes são Preferíveis', file: 'content/lesson-4.1-benevolent-dictators-are-sometimes-preferable.md' },
                { id: 'lesson-4.2', title: 'Um Fluxo de Trabalho de Anotação Colaborativa', file: 'content/lesson-4.2-a-collaborative-annotation-workflow.md' },
                { id: 'lesson-4.3', title: 'Medindo Concordância Inter-Anotador', file: 'content/lesson-4.3-measuring-inter-annotator-agreement.md' },
                { id: 'lesson-4.4', title: 'Facilitando Sessões de Alinhamento e Resolvendo Desacordos', file: 'content/lesson-4.4-facilitating-alignment-sessions-and-resolving-disagreements.md' },
                { id: 'lesson-4.5', title: 'Conectando Labels Colaborativos a Avaliadores Automatizados', file: 'content/lesson-4.5-connecting-collaborative-labels-to-automated-evaluators.md' },
                { id: 'lesson-4.6', title: 'Armadilhas Comuns na Avaliação Colaborativa', file: 'content/lesson-4.6-common-pitfalls-in-collaborative-evaluation.md' },
                { id: 'lesson-4.7', title: 'Resumo', file: 'content/lesson-4.7-summary.md' },
                { id: 'lesson-4.8', title: 'Exercícios', file: 'content/lesson-4.8-exercises.md' }
            ]
        },
        {
            id: 'module-5',
            title: 'Métricas e Avaliação',
            icon: 'fas fa-chart-line',
            lessons: [
                { id: 'lesson-5.1', title: 'Definindo as Métricas Certas', file: 'content/lesson-5.1-defining-right-metrics.md' },
                { id: 'lesson-5.2', title: 'Implementando Métricas', file: 'content/lesson-5.2-implementing-metrics.md' },
                { id: 'lesson-5.3', title: 'LLM como Juiz: Prompts', file: 'content/lesson-5.3-llm_as_judge_prompts.md' },
                { id: 'lesson-5.4', title: 'Divisões de Dados e LLM como Juiz', file: 'content/lesson-5.4_data_splits_llm_as_judge.md' },
                { id: 'lesson-5.5', title: 'Refinamento Iterativo de Prompts', file: 'content/lesson-5.5_iterative_prompt_refinement.md' },
                { id: 'lesson-5.6', title: 'Sucesso Real com Juízes Imperfeitos', file: 'content/lesson-5.6_true_success_with_imperfect_judges.md' },
                { id: 'lesson-5.7', title: 'Estimativa de Taxa de Sucesso em Python', file: 'content/lesson-5.7_python_success_rate_estimation.md' },
                { id: 'lesson-5.8', title: 'Métricas por Grupo', file: 'content/lesson-5.8_groupwise_metrics.md' },
                { id: 'lesson-5.9', title: 'Armadilhas Comuns', file: 'content/lesson-5.9_common_pitfalls.md' },
                { id: 'lesson-5.10', title: 'Resumo', file: 'content/lesson_5_10_summary.md' }
            ]
        },
        {
            id: 'module-6',
            title: 'Avaliação Multi-Turn',
            icon: 'fas fa-comments',
            lessons: [
                { id: 'lesson-6.1', title: 'Visão Geral', file: 'content/lesson-6.1_overview_multi_turn.md' },
                { id: 'lesson-6.2', title: 'Estratégias Práticas', file: 'content/lesson-6.2_practical_strategies_multi_turn.md' },
                { id: 'lesson-6.3', title: 'Avaliação Automatizada', file: 'content/lesson-6.3_automated_eval_multi_turn.md' },
                { id: 'lesson-6.4', title: 'Armadilhas', file: 'content/lesson-6.4_pitfalls_multi_turn.md' },
                { id: 'lesson-6.5', title: 'Resumo', file: 'content/lesson-6.5_summary.md' }
            ]
        },
        {
            id: 'module-7',
            title: 'Avaliação RAG',
            icon: 'fas fa-database',
            lessons: [
                { id: 'lesson-7.1', title: 'Visão Geral', file: 'content/lesson-7.1_overview_rag.md' },
                { id: 'lesson-7.2', title: 'Pares de Consulta-Resposta Sintéticos', file: 'content/lesson-7.2_synth_query_answer_pairs.md' },
                { id: 'lesson-7.3', title: 'Métricas de Recuperação', file: 'content/lesson-7.3_metrics_retrieval.md' },
                { id: 'lesson-7.4', title: 'Qualidade de Geração', file: 'content/lesson-7.4_generation_quality.md' },
                { id: 'lesson-7.5', title: 'Armadilhas Comuns', file: 'content/lesson-7.5_common_pitfalls.md' },
                { id: 'lesson-7.6', title: 'Resumo', file: 'content/lesson-7.6_summary.md' },
                { id: 'lesson-7.7', title: 'Exercícios', file: 'content/lesson-7.7_exercises.md' }
            ]
        },
        {
            id: 'module-8',
            title: 'Sistemas Agênticos',
            icon: 'fas fa-cogs',
            lessons: [
                { id: 'lesson-8.1', title: 'Chamada de Ferramentas', file: 'content/lesson-8.1_tool_calling.md' },
                { id: 'lesson-8.2', title: 'Sistemas Agênticos', file: 'content/lesson-8.2_agentic_systems.md' },
                { id: 'lesson-8.3', title: 'Debugging de Pipelines Multi-Etapa', file: 'content/lesson-8.3_debugging_multi_step_pipelines.md' },
                { id: 'lesson-8.4', title: 'Modalidades', file: 'content/lesson-8.4_modalities.md' },
                { id: 'lesson-8.5', title: 'Armadilhas Comuns', file: 'content/lesson-8.5_common_pitfalls.md' },
                { id: 'lesson-8.6', title: 'Resumo', file: 'content/lesson-8.6_summary.md' }
            ]
        },
        {
            id: 'module-9',
            title: 'Produção e Monitoramento',
            icon: 'fas fa-rocket',
            lessons: [
                { id: 'lesson-9.1', title: 'CI como Rede de Segurança', file: 'content/lesson-9.1_ci_safety_net.md' },
                { id: 'lesson-9.2', title: 'CD e Monitoramento Online', file: 'content/lesson-9.2_cd_online_monitoring.md' },
                { id: 'lesson-9.3', title: 'Roda de Melhoria Contínua', file: 'content/lesson-9.3_continuous_improvement_flywheel.md' },
                { id: 'lesson-9.4', title: 'Armadilhas Práticas na Avaliação de Produção', file: 'content/lesson-9.4_practical_pitfalls_production_eval.md' },
                { id: 'lesson-9.5', title: 'Resumo', file: 'content/lesson-9.5_summary.md' }
            ]
        }
    ]
};

// Estado da aplicação
let currentLesson = null;
let completedLessons = new Set();
let currentModuleIndex = 0;
let currentLessonIndex = 0;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    loadProgress();
    renderSidebar();
    updateStats();
    setupEventListeners();
});

// Carregar progresso salvo
function loadProgress() {
    const saved = localStorage.getItem('ai-evals-progress');
    if (saved) {
        completedLessons = new Set(JSON.parse(saved));
    }
}

// Salvar progresso
function saveProgress() {
    localStorage.setItem('ai-evals-progress', JSON.stringify([...completedLessons]));
}

// Renderizar sidebar
function renderSidebar() {
    const moduleList = document.getElementById('module-list');
    moduleList.innerHTML = '';

    courseStructure.modules.forEach((module, moduleIndex) => {
        const moduleElement = createModuleElement(module, moduleIndex);
        moduleList.appendChild(moduleElement);
    });

    updateOverallProgress();
}

// Criar elemento de módulo
function createModuleElement(module, moduleIndex) {
    const moduleDiv = document.createElement('div');
    moduleDiv.className = 'module';
    moduleDiv.id = module.id;

    const completedCount = module.lessons.filter(lesson => completedLessons.has(lesson.id)).length;
    const totalCount = module.lessons.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    moduleDiv.innerHTML = `
        <div class="module-header" onclick="toggleModule('${module.id}')">
            <div class="module-title">
                <i class="${module.icon}"></i>
                <span>${module.title}</span>
            </div>
            <div class="module-info">
                <span class="module-progress">${completedCount}/${totalCount}</span>
                <i class="fas fa-chevron-right module-arrow"></i>
            </div>
        </div>
        <div class="lesson-list">
            ${module.lessons.map((lesson, lessonIndex) => {
                const isCompleted = completedLessons.has(lesson.id);
                const isActive = currentLesson && currentLesson.id === lesson.id;
                return `
                    <div class="lesson-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}" 
                         onclick="loadLesson('${lesson.id}', ${moduleIndex}, ${lessonIndex})">
                        <span class="lesson-title">${lesson.title}</span>
                        <div class="lesson-status ${isCompleted ? 'completed' : 'pending'}">
                            ${isCompleted ? '<i class="fas fa-check"></i>' : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    return moduleDiv;
}

// Alternar módulo expandido/colapsado
function toggleModule(moduleId) {
    const module = document.getElementById(moduleId);
    module.classList.toggle('expanded');
}

// Carregar aula
async function loadLesson(lessonId, moduleIndex, lessonIndex) {
    const lesson = courseStructure.modules[moduleIndex].lessons[lessonIndex];
    
    if (!lesson) return;

    currentLesson = lesson;
    currentModuleIndex = moduleIndex;
    currentLessonIndex = lessonIndex;

    // Atualizar navegação
    updateNavigation();
    
    // Atualizar breadcrumb
    const module = courseStructure.modules[moduleIndex];
    document.getElementById('breadcrumb').innerHTML = `
        <span>${module.title}</span> > <span>${lesson.title}</span>
    `;

    // Carregar conteúdo da aula
    try {
        const response = await fetch(lesson.file);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const markdown = await response.text();
        const html = convertMarkdownToHtml(markdown);
        
        document.getElementById('lesson-content').innerHTML = `
            <div class="lesson-markdown">${html}</div>
        `;

        // Atualizar estado dos botões
        updateLessonControls();
        
        // Atualizar sidebar
        renderSidebar();
        
        // Scroll para o topo
        window.scrollTo(0, 0);
        
    } catch (error) {
        console.error('Erro ao carregar aula:', error);
        document.getElementById('lesson-content').innerHTML = `
            <div class="error-message">
                <h2>Erro ao carregar aula</h2>
                <p>Não foi possível carregar o conteúdo da aula "${lesson.title}".</p>
                <p>Erro: ${error.message}</p>
            </div>
        `;
    }
}

// Converter Markdown para HTML (simplificado)
function convertMarkdownToHtml(markdown) {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    
    // Lists
    html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    
    // Wrap lists in ul/ol
    html = html.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>');
    
    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/^(?!<[h|li|ul|ol|pre|blockquote]).*$/gm, '<p>$&</p>');
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
}

// Atualizar navegação
function updateNavigation() {
    const prevBtn = document.getElementById('prev-lesson');
    const nextBtn = document.getElementById('next-lesson');
    
    prevBtn.disabled = currentLessonIndex === 0;
    nextBtn.disabled = currentLessonIndex === courseStructure.modules[currentModuleIndex].lessons.length - 1;
}

// Atualizar controles da aula
function updateLessonControls() {
    const markCompleteBtn = document.getElementById('mark-complete');
    const isCompleted = completedLessons.has(currentLesson.id);
    
    if (isCompleted) {
        markCompleteBtn.innerHTML = '<i class="fas fa-undo"></i> Marcar como Incompleto';
        markCompleteBtn.classList.remove('btn-primary');
        markCompleteBtn.classList.add('btn-secondary');
    } else {
        markCompleteBtn.innerHTML = '<i class="fas fa-check"></i> Marcar como Concluído';
        markCompleteBtn.classList.remove('btn-secondary');
        markCompleteBtn.classList.add('btn-primary');
    }
}

// Marcar aula como concluída/incompleta
function toggleLessonCompletion() {
    if (!currentLesson) return;
    
    if (completedLessons.has(currentLesson.id)) {
        completedLessons.delete(currentLesson.id);
    } else {
        completedLessons.add(currentLesson.id);
    }
    
    saveProgress();
    updateOverallProgress();
    renderSidebar();
    updateLessonControls();
    updateStats();
}

// Navegar para aula anterior
function goToPreviousLesson() {
    if (currentLessonIndex > 0) {
        loadLesson(
            courseStructure.modules[currentModuleIndex].lessons[currentLessonIndex - 1].id,
            currentModuleIndex,
            currentLessonIndex - 1
        );
    }
}

// Navegar para próxima aula
function goToNextLesson() {
    if (currentLessonIndex < courseStructure.modules[currentModuleIndex].lessons.length - 1) {
        loadLesson(
            courseStructure.modules[currentModuleIndex].lessons[currentLessonIndex + 1].id,
            currentModuleIndex,
            currentLessonIndex + 1
        );
    }
}

// Atualizar progresso geral
function updateOverallProgress() {
    const totalLessons = courseStructure.modules.reduce((total, module) => total + module.lessons.length, 0);
    const completedCount = completedLessons.size;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    
    document.getElementById('overall-progress').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').textContent = `${progressPercent}% completo`;
}

// Atualizar estatísticas
function updateStats() {
    const totalLessons = courseStructure.modules.reduce((total, module) => total + module.lessons.length, 0);
    const totalModules = courseStructure.modules.length;
    const estimatedHours = Math.round(totalLessons * 0.5); // 30 min por aula
    
    document.getElementById('total-lessons').textContent = totalLessons;
    document.getElementById('total-modules').textContent = totalModules;
    document.getElementById('estimated-hours').textContent = estimatedHours;
}

// Configurar event listeners
function setupEventListeners() {
    // Botão marcar como concluído
    document.getElementById('mark-complete').addEventListener('click', toggleLessonCompletion);
    
    // Botões de navegação
    document.getElementById('prev-lesson').addEventListener('click', goToPreviousLesson);
    document.getElementById('next-lesson').addEventListener('click', goToNextLesson);
    
    // Botão começar curso
    document.getElementById('start-course').addEventListener('click', () => {
        if (courseStructure.modules.length > 0 && courseStructure.modules[0].lessons.length > 0) {
            loadLesson(
                courseStructure.modules[0].lessons[0].id,
                0,
                0
            );
        }
    });
}

// Funções globais para uso no HTML
window.toggleModule = toggleModule;
window.loadLesson = loadLesson;
