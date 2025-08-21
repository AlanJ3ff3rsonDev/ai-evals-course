// Course structure organized by modules
const courseStructure = {
    modules: [
        {
            id: 'module-1',
            title: 'Evaluation Fundamentals',
            icon: 'fas fa-lightbulb',
            lessons: [
                { id: 'lesson-1.1', title: 'What is Evaluation?', file: 'content/lesson-1.1-what-is-evaluation.md' },
                { id: 'lesson-1.2', title: 'Three Gulfs of Development', file: 'content/lesson-1.2-three-gulfs-of-llm-pipeline-development.md' },
                { id: 'lesson-1.3', title: 'Why Evaluation is Challenging?', file: 'content/lesson-1.3-why-llm-pipeline-evaluation-is-challenging.md' },
                { id: 'lesson-1.4', title: 'Evaluation Lifecycle', file: 'content/lesson-1.4-llm-evaluation-lifecycle.md' },
                { id: 'lesson-1.5', title: 'Summary', file: 'content/lesson-1.5-summary.md' }
            ]
        },
        {
            id: 'module-2',
            title: 'Understanding LLMs',
            icon: 'fas fa-brain',
            lessons: [
                { id: 'lesson-2.1', title: 'Strengths and Weaknesses', file: 'content/lesson-2.1-strengths-and-weaknesses-of-llms.md' },
                { id: 'lesson-2.2', title: 'Prompting Fundamentals', file: 'content/lesson-2.2-prompting-fundamentals.md' },
                { id: 'lesson-2.3', title: 'Defining Evaluation Metrics', file: 'content/lesson-2.3-defining-good-types-of-evaluation-metrics.md' },
                { id: 'lesson-2.4', title: 'Foundation vs Application Centered Evals', file: 'content/lesson-2.4-foundation-vs-application-centric-evals.md' },
                { id: 'lesson-2.5', title: 'Eliciting Labels for Metrics', file: 'content/lesson-2.5-eliciting-labels-for-metric-computation.md' },
                { id: 'lesson-2.6', title: 'Summary', file: 'content/lesson-2.6-summary.md' },
                { id: 'lesson-2.7', title: 'Glossary of Terms', file: 'content/lesson-2.7-glossary-of-terms.md' },
                { id: 'lesson-2.8', title: 'Exercises', file: 'content/lesson-2.8-exercises.md' }
            ]
        },
        {
            id: 'module-3',
            title: 'Error Analysis',
            icon: 'fas fa-search',
            lessons: [
                { id: 'lesson-3.1', title: 'Bootstrap Initial Dataset', file: 'content/lesson-3.1-bootstrap-a-starting-dataset.md' },
                { id: 'lesson-3.2', title: 'Open Coding: Read and Label Traces', file: 'content/lesson-3.2-open-coding-read-and-label-traces.md' },
                { id: 'lesson-3.3', title: 'Axial Coding: Structure and Merge Failure Modes', file: 'content/lesson-3.3-axial-coding-structuring-and-merging-failure-modes.md' },
                { id: 'lesson-3.4', title: 'Labeling Traces After Structuring Failure Modes', file: 'content/lesson-3.4-labeling-traces-after-structuring-failure-modes.md' },
                { id: 'lesson-3.5', title: 'Iteration and Refining Failure Taxonomy', file: 'content/lesson-3.5-iteration-and-refining-the-failure-taxonomy.md' },
                { id: 'lesson-3.6', title: 'Common Pitfalls', file: 'content/lesson-3.6-common-pitfalls.md' },
                { id: 'lesson-3.7', title: 'Error Analysis Summary', file: 'content/lesson-3.7-summary-of-error-analysis.md' },
                { id: 'lesson-3.8', title: 'Exercises', file: 'content/lesson-3.8-exercises.md' }
            ]
        },
        {
            id: 'module-4',
            title: 'Collaborative Evaluation',
            icon: 'fas fa-users',
            lessons: [
                { id: 'lesson-4.1', title: 'Benevolent Dictators are Sometimes Preferable', file: 'content/lesson-4.1-benevolent-dictators-are-sometimes-preferable.md' },
                { id: 'lesson-4.2', title: 'A Collaborative Annotation Workflow', file: 'content/lesson-4.2-a-collaborative-annotation-workflow.md' },
                { id: 'lesson-4.3', title: 'Measuring Inter-Annotator Agreement', file: 'content/lesson-4.3-measuring-inter-annotator-agreement.md' },
                { id: 'lesson-4.4', title: 'Facilitating Alignment Sessions and Resolving Disagreements', file: 'content/lesson-4.4-facilitating-alignment-sessions-and-resolving-disagreements.md' },
                { id: 'lesson-4.5', title: 'Connecting Collaborative Labels to Automated Evaluators', file: 'content/lesson-4.5-connecting-collaborative-labels-to-automated-evaluators.md' },
                { id: 'lesson-4.6', title: 'Common Pitfalls in Collaborative Evaluation', file: 'content/lesson-4.6-common-pitfalls-in-collaborative-evaluation.md' },
                { id: 'lesson-4.7', title: 'Summary', file: 'content/lesson-4.7-summary.md' },
                { id: 'lesson-4.8', title: 'Exercises', file: 'content/lesson-4.8-exercises.md' }
            ]
        },
        {
            id: 'module-5',
            title: 'Metrics and Evaluation',
            icon: 'fas fa-chart-line',
            lessons: [
                { id: 'lesson-5.1', title: 'Defining the Right Metrics', file: 'content/lesson-5.1-defining-right-metrics.md' },
                { id: 'lesson-5.2', title: 'Implementing Metrics', file: 'content/lesson_5_2_implementing_metrics.md' },
                { id: 'lesson-5.3', title: 'LLM as Judge: Prompts', file: 'content/lesson_5_3_llm_as_judge_prompts.md' },
                { id: 'lesson-5.4', title: 'Data Splits and LLM as Judge', file: 'content/lesson_5_4_data_splits_llm_as_judge.md' },
                { id: 'lesson-5.5', title: 'Iterative Prompt Refinement', file: 'content/lesson_5_5_iterative_prompt_refinement.md' },
                { id: 'lesson-5.6', title: 'True Success with Imperfect Judges', file: 'content/lesson_5_6_true_success_with_imperfect_judges.md' },
                { id: 'lesson-5.7', title: 'Python Success Rate Estimation', file: 'content/lesson_5_7_python_success_rate_estimation.md' },
                { id: 'lesson-5.8', title: 'Groupwise Metrics', file: 'content/lesson_5_8_groupwise_metrics.md' },
                { id: 'lesson-5.9', title: 'Common Pitfalls', file: 'content/lesson_5_9_common_pitfalls.md' },
                { id: 'lesson-5.10', title: 'Summary', file: 'content/lesson_5_10_summary.md' }
            ]
        },
        {
            id: 'module-6',
            title: 'Multi-Turn Evaluation',
            icon: 'fas fa-comments',
            lessons: [
                { id: 'lesson-6.1', title: 'Overview', file: 'content/lesson_6_1_overview_multi_turn.md' },
                { id: 'lesson-6.2', title: 'Practical Strategies', file: 'content/lesson_6_2_practical_strategies_multi_turn.md' },
                { id: 'lesson-6.3', title: 'Automated Evaluation', file: 'content/lesson_6_3_automated_eval_multi_turn.md' },
                { id: 'lesson-6.4', title: 'Pitfalls', file: 'content/lesson_6_4_pitfalls_multi_turn.md' },
                { id: 'lesson-6.5', title: 'Summary', file: 'content/lesson_6_5_summary.md' }
            ]
        },
        {
            id: 'module-7',
            title: 'RAG Evaluation',
            icon: 'fas fa-database',
            lessons: [
                { id: 'lesson-7.1', title: 'Overview', file: 'content/lesson_7_1_overview_rag.md' },
                { id: 'lesson-7.2', title: 'Synthetic Query-Answer Pairs', file: 'content/lesson_7_2_synth_query_answer_pairs.md' },
                { id: 'lesson-7.3', title: 'Retrieval Metrics', file: 'content/lesson_7_3_metrics_retrieval.md' },
                { id: 'lesson-7.4', title: 'Generation Quality', file: 'content/lesson_7_4_generation_quality.md' },
                { id: 'lesson-7.5', title: 'Common Pitfalls', file: 'content/lesson_7_5_common_pitfalls.md' },
                { id: 'lesson-7.6', title: 'Summary', file: 'content/lesson_7_6_summary.md' },
                { id: 'lesson-7.7', title: 'Exercises', file: 'content/lesson_7_7_exercises.md' }
            ]
        },
        {
            id: 'module-8',
            title: 'Agentic Systems',
            icon: 'fas fa-cogs',
            lessons: [
                { id: 'lesson-8.1', title: 'Tool Calling', file: 'content/lesson_8_1_tool_calling.md' },
                { id: 'lesson-8.2', title: 'Agentic Systems', file: 'content/lesson_8_2_agentic_systems.md' },
                { id: 'lesson-8.3', title: 'Debugging Multi-Step Pipelines', file: 'content/lesson_8_3_debugging_multi_step_pipelines.md' },
                { id: 'lesson-8.4', title: 'Modalities', file: 'content/lesson_8_4_modalities.md' },
                { id: 'lesson-8.5', title: 'Common Pitfalls', file: 'content/lesson_8_5_common_pitfalls.md' },
                { id: 'lesson-8.6', title: 'Summary', file: 'content/lesson_8_6_summary.md' }
            ]
        },
        {
            id: 'module-9',
            title: 'Production and Monitoring',
            icon: 'fas fa-rocket',
            lessons: [
                { id: 'lesson-9.1', title: 'CI as Safety Net', file: 'content/lesson_9_1_ci_safety_net.md' },
                { id: 'lesson-9.2', title: 'CD and Online Monitoring', file: 'content/lesson_9_2_cd_online_monitoring.md' },
                { id: 'lesson-9.3', title: 'Continuous Improvement Flywheel', file: 'content/lesson_9_3_continuous_improvement_flywheel.md' },
                { id: 'lesson-9.4', title: 'Practical Pitfalls in Production Evaluation', file: 'content/lesson_9_4_practical_pitfalls_production_eval.md' },
                { id: 'lesson-9.5', title: 'Summary', file: 'content/lesson_9_5_summary.md' }
            ]
        }
    ]
};

// Application state
let currentLesson = null;
let completedLessons = new Set();
let currentModuleIndex = 0;
let currentLessonIndex = 0;

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    loadProgress();
    renderSidebar();
    updateStats();
    setupEventListeners();
});

// Load saved progress
function loadProgress() {
    const saved = localStorage.getItem('ai-evals-progress');
    if (saved) {
        completedLessons = new Set(JSON.parse(saved));
    }
}

// Save progress
function saveProgress() {
    localStorage.setItem('ai-evals-progress', JSON.stringify([...completedLessons]));
}

// Render sidebar
function renderSidebar() {
    const moduleList = document.getElementById('module-list');
    moduleList.innerHTML = '';

    courseStructure.modules.forEach((module, moduleIndex) => {
        const moduleElement = createModuleElement(module, moduleIndex);
        moduleList.appendChild(moduleElement);
    });

    updateOverallProgress();
}

// Create module element
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

// Toggle module expanded/collapsed
function toggleModule(moduleId) {
    const module = document.getElementById(moduleId);
    module.classList.toggle('expanded');
}

// Load lesson
async function loadLesson(lessonId, moduleIndex, lessonIndex) {
    const lesson = courseStructure.modules[moduleIndex].lessons[lessonIndex];
    
    if (!lesson) return;

    currentLesson = lesson;
    currentModuleIndex = moduleIndex;
    currentLessonIndex = lessonIndex;

    // Update navigation
    updateNavigation();
    
    // Update breadcrumb
    const module = courseStructure.modules[moduleIndex];
    document.getElementById('breadcrumb').innerHTML = `
        <span>${module.title}</span> > <span>${lesson.title}</span>
    `;

    // Load lesson content
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

        // Update button states
        updateLessonControls();
        
        // Update sidebar
        renderSidebar();
        
        // Scroll to top
        window.scrollTo(0, 0);
        
    } catch (error) {
        console.error('Error loading lesson:', error);
        document.getElementById('lesson-content').innerHTML = `
            <div class="error-message">
                <h2>Error loading lesson</h2>
                <p>Could not load the content of lesson "${lesson.title}".</p>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

// Convert Markdown to HTML (simplified)
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

// Update navigation
function updateNavigation() {
    const prevBtn = document.getElementById('prev-lesson');
    const nextBtn = document.getElementById('next-lesson');
    
    prevBtn.disabled = currentLessonIndex === 0;
    nextBtn.disabled = currentLessonIndex === courseStructure.modules[currentModuleIndex].lessons.length - 1;
}

// Update lesson controls
function updateLessonControls() {
    const markCompleteBtn = document.getElementById('mark-complete');
    const isCompleted = completedLessons.has(currentLesson.id);
    
    if (isCompleted) {
        markCompleteBtn.innerHTML = '<i class="fas fa-undo"></i> Mark as Incomplete';
        markCompleteBtn.classList.remove('btn-primary');
        markCompleteBtn.classList.add('btn-secondary');
    } else {
        markCompleteBtn.innerHTML = '<i class="fas fa-check"></i> Mark as Complete';
        markCompleteBtn.classList.remove('btn-secondary');
        markCompleteBtn.classList.add('btn-primary');
    }
}

// Mark lesson as completed/incomplete
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

// Navigate to previous lesson
function goToPreviousLesson() {
    if (currentLessonIndex > 0) {
        loadLesson(
            courseStructure.modules[currentModuleIndex].lessons[currentLessonIndex - 1].id,
            currentModuleIndex,
            currentLessonIndex - 1
        );
    }
}

// Navigate to next lesson
function goToNextLesson() {
    if (currentLessonIndex < courseStructure.modules[currentModuleIndex].lessons.length - 1) {
        loadLesson(
            courseStructure.modules[currentModuleIndex].lessons[currentLessonIndex + 1].id,
            currentModuleIndex,
            currentLessonIndex + 1
        );
    }
}

// Update overall progress
function updateOverallProgress() {
    const totalLessons = courseStructure.modules.reduce((total, module) => total + module.lessons.length, 0);
    const completedCount = completedLessons.size;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    
    document.getElementById('overall-progress').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').textContent = `${progressPercent}% complete`;
}

// Update statistics
function updateStats() {
    const totalLessons = courseStructure.modules.reduce((total, module) => total + module.lessons.length, 0);
    const totalModules = courseStructure.modules.length;
    const estimatedHours = Math.round(totalLessons * 0.5); // 30 min per lesson
    
    document.getElementById('total-lessons').textContent = totalLessons;
    document.getElementById('total-modules').textContent = totalModules;
    document.getElementById('estimated-hours').textContent = estimatedHours;
}

// Setup event listeners
function setupEventListeners() {
    // Mark as complete button
    document.getElementById('mark-complete').addEventListener('click', toggleLessonCompletion);
    
    // Navigation buttons
    document.getElementById('prev-lesson').addEventListener('click', goToPreviousLesson);
    document.getElementById('next-lesson').addEventListener('click', goToNextLesson);
    
    // Start course button
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

// Global functions for HTML use
window.toggleModule = toggleModule;
window.loadLesson = loadLesson;
