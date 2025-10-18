document.addEventListener('DOMContentLoaded', () => {
    // --- 1. REFERENCIAS A ELEMENTOS DEL DOM ---
    // Contenedores de las vistas principales
    const examListContainer = document.getElementById('exam-list-container');
    const examDetailContainer = document.getElementById('exam-detail-container');
    const examTakingContainer = document.getElementById('exam-taking-container');

    // Elementos de la vista de Lista
    const examList = document.getElementById('exam-list');

    // Elementos de la vista de Detalles
    const backToListBtn = document.getElementById('back-to-list-btn');
    const examDetailsContent = document.getElementById('exam-details-content');
    const classificationTableBody = document.getElementById('classification-table-body');
    // FIX 1: Obtenemos la referencia al botón que YA EXISTE en el HTML, en lugar de crear uno nuevo.
    const startExamBtn = document.getElementById('start-exam-btn');

    // Elementos de la vista de "Hacer Examen"
    const examTitleTaking = document.getElementById('exam-title-taking');
    const questionContainer = document.getElementById('question-container');
    const nextQuestionBtn = document.getElementById('next-question-btn');

    const userKeyModal = document.getElementById('user-key-modal');
    const userKeyForm = document.getElementById('user-key-form');
    const userKeyInput = document.getElementById('user-key-input');
    const cancelKeyBtn = document.getElementById('cancel-key-btn');

    // --- 2. VARIABLES DE ESTADO DE LA APLICACIÓN ---
    let currentExam = null; // Guardará los detalles del examen actual
    let currentQuestions = []; // Array para las preguntas del examen actual
    let currentQuestionIndex = 0; // Índice para la pregunta actual
    let userAnswers = []; // Array para guardar las respuestas del usuario
    let userKey = null; // Clave del usuario para el examen


    // --- 3. FUNCIONES PARA OBTENER DATOS (API) ---

    /**
     * Obtiene y renderiza la lista de todos los exámenes disponibles.
     */
    const fetchExams = async () => {
        try {
            const response = await fetch('/awp/api/sync.php?scope=examenes_publicos');
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            const exams = await response.json();
            renderExams(exams);
        } catch (error) {
            console.error('Error fetching exams:', error);
            examList.innerHTML = '<p>Error al cargar los exámenes. Por favor, inténtalo de nuevo más tarde.</p>';
        }
    };

    /**
     * Obtiene los detalles y la clasificación de un examen específico.
     * @param {number} examId - El ID del examen a consultar.
     */
    const fetchExamDetails = async (examId) => {
        try {
            // Hacemos las dos peticiones en paralelo para más eficiencia
            const [detailsResponse, classificationResponse] = await Promise.all([
                fetch(`/awp/api/sync.php?scope=examen&id=${examId}`),
                fetch(`/awp/api/sync.php?scope=clasificacion&idExamen=${examId}`)
            ]);

            currentExam = await detailsResponse.json(); // Guardamos los detalles del examen en el estado
            const classification = await classificationResponse.json();

            renderExamDetails(currentExam);
            renderClassification(classification);

            // Cambiamos a la vista de detalles
            examListContainer.style.display = 'none';
            examDetailContainer.style.display = 'block';
        } catch (error) {
            console.error('Error fetching exam details:', error);
        }
    };

    /**
     * Obtiene las preguntas para el examen actual y comienza el proceso.
     */
    const fetchAndStartExam = async () => {
        if (!currentExam) return;
        try {
            const response = await fetch(`/awp/api/sync.php?scope=preguntas&examen_id=${currentExam.idExamen}`);
            currentQuestions = await response.json();
            if (!currentQuestions || currentQuestions.length === 0) {
                alert('Este examen no tiene preguntas.');
                return;
            }
            currentQuestionIndex = 0;
            userAnswers = [];
            examDetailContainer.style.display = 'none';
            examTakingContainer.style.display = 'block';
            examTitleTaking.textContent = currentExam.tituloexamen;
            nextQuestionBtn.style.display = 'block';
            renderQuestion();
        } catch (error) { console.error('Error starting exam:', error); }
    };

    const submitExamResults = async () => {
        const payload = {
            clave: userKey,
            respuestas: userAnswers.map(answer => answer.answer_id)
        };

        // Mostramos un mensaje optimista al usuario inmediatamente
        showFinalScore(); 

        // Verificamos si el Service Worker y Background Sync están disponibles
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            // Guardamos los datos en IndexedDB y le pedimos al SW que sincronice
            navigator.serviceWorker.ready.then(async (swRegistration) => {
                
                try {
                    // 1. Guardar el payload en IndexedDB para persistencia.
                    // Usamos la función global que exportamos desde idb-manager.js
                    await window.dbManager.saveSingleItemToDB('pending_submissions', payload);

                    // 2. Pedir una sincronización en segundo plano.
                    // Esto le dice al SW que intente enviar los datos cuando haya conexión.
                    return swRegistration.sync.register('sync-exam-submissions');

                } catch (dbError) {
                    console.error('Error al guardar en IndexedDB, intentando envío directo:', dbError);
                    // Si falla el guardado en la BD local (muy raro), intentamos el envío directo.
                    sendDataDirectly(payload);
                }

            }).then(() => {
                console.log('Sincronización en segundo plano registrada para el envío del examen.');
            }).catch(err => {
                // Si el registro de la sincronización falla, intentamos un fetch normal como fallback
                console.error('El registro de Background Sync falló, intentando envío directo:', err);
                sendDataDirectly(payload);
            });
        } else {
            // Si no hay soporte para SW o Background Sync, hacemos un fetch normal
            console.log('Background Sync no soportado, intentando envío directo.');
            sendDataDirectly(payload);
        }
    };

    async function sendDataDirectly(payload) {
        try {
            const response = await fetch('/awp/api/sync.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'submit_examen', payload })
            });
            if (!response.ok) {
                console.error('El envío directo falló.');
                // Aquí podríamos notificar al usuario que su envío falló
            } else {
                console.log('Envío directo exitoso.');
            }
        } catch (error) {
            console.error('Error en el envío directo:', error);
            // Notificar al usuario que está offline y su envío no se pudo realizar
        }
    }


    // --- 4. FUNCIONES PARA RENDERIZAR ---

    /**
     * Pinta la lista de exámenes en el DOM.
     * @param {Array} exams - El array de objetos de examen.
     */
    const renderExams = (exams) => {
        examList.innerHTML = ''; // Limpiamos la lista
        if (!exams || exams.length === 0) {
            examList.innerHTML = '<p>No hay exámenes disponibles en este momento.</p>';
            return;
        }
        exams.forEach(exam => {
            const examElement = document.createElement('div');
            examElement.className = 'col-4 col-12-medium';
            examElement.innerHTML = `
                <section class="box feature">
                    <h3>${exam.tituloexamen}</h3>
                    <p>${exam.descripcion}</p>
                    <ul class="actions">
                        <li><a href="#" class="button alt view-details-btn" data-id="${exam.idExamen}">Ver Detalles</a></li>
                    </ul>
                </section>
            `;
            examList.appendChild(examElement);
        });
    };

    /**
     * Pinta los detalles del examen seleccionado.
     * @param {object} exam - El objeto con los detalles del examen.
     */
    const renderExamDetails = (exam) => {
        examDetailsContent.innerHTML = `
            <h3>${exam.tituloexamen}</h3>
            <p>${exam.descripcion}</p>
        `;
    };

    /**
     * Pinta la tabla de clasificación.
     * @param {Array} classification - El array con los datos de la clasificación.
     */
    const renderClassification = (classification) => {
        classificationTableBody.innerHTML = '';
        if (!classification || classification.length === 0) {
            classificationTableBody.innerHTML = '<tr><td colspan="4">Aún no hay resultados para este examen. ¡Sé el primero!</td></tr>';
            return;
        }
        classification.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${entry.Clave}</td>
                <td>${entry.puntaje_obtenido} / ${entry.puntaje_maximo}</td>
                <td>${parseFloat(entry.porcentaje).toFixed(2)}%</td>
            `;
            classificationTableBody.appendChild(row);
        });
    };

    /**
     * Pinta la pregunta actual con sus opciones.
     */
    const renderQuestion = () => {
        const question = currentQuestions[currentQuestionIndex];
        questionContainer.innerHTML = `
            <h4>${currentQuestionIndex + 1}. ${question.question}</h4>
            <div class="options">
                ${question.options.map((option, index) => `
                    <div class="option" style="margin-bottom: 10px;">
                        <input type="radio" id="option${index}" name="answer" 
                               value="${option.option}" 
                               data-answer-id="${option.idRespuesta}"> 
                        <label for="option${index}" style="margin-left: 10px;">${option.option}</label>
                    </div>
                `).join('')}
            </div>
        `;
    };


    // --- 5. LÓGICA DE LA INTERFAZ Y FLUJO DEL EXAMEN ---

    /**
     * Maneja el click en "Siguiente Pregunta". Guarda la respuesta y avanza.
     */
    const handleNextQuestion = () => {
        const selectedOption = document.querySelector('input[name="answer"]:checked');
        if (!selectedOption) {
            alert('Por favor, selecciona una respuesta.');
            return;
        }
        // **MODIFICADO**: Guardamos el ID de la respuesta, no solo el texto
        userAnswers.push({
            question_id: currentQuestions[currentQuestionIndex].id,
            answer_text: selectedOption.value,
            answer_id: selectedOption.dataset.answerId 
        });

        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            renderQuestion();
        } else {
            submitExamResults(); // Al terminar, enviamos los resultados
        }
    };

    const showFinalScore = () => {
        let score = 0;
        userAnswers.forEach((userAnswer, index) => {
            const question = currentQuestions[index];
            const correctAnswer = question.options.find(opt => opt.is_correct == 1);
            if (correctAnswer && userAnswer.answer_text === correctAnswer.option) {
                score++;
            }
        });

        const percentage = (score / currentQuestions.length) * 100;

        questionContainer.innerHTML = `
            <h2>Examen Finalizado</h2>
            <p>¡Gracias por participar, <strong>${userKey}</strong>!</p>
            <p>Tu puntaje es: <strong>${score} de ${currentQuestions.length}</strong></p>
            <p>Porcentaje de aciertos: <strong>${percentage.toFixed(2)}%</strong></p>
            <button id="back-to-details-btn" class="button">Ver Tabla de Clasificación Actualizada</button>
        `;
    };

    // --- 6. EVENT LISTENERS ---

    // Usamos delegación de eventos en la lista de exámenes para manejar los clicks
    examList.addEventListener('click', (e) => {
        const detailsButton = e.target.closest('.view-details-btn');
        if (detailsButton) {
            e.preventDefault();
            fetchExamDetails(detailsButton.dataset.id);
        }
    });

    // Botón para volver a la lista desde los detalles
    backToListBtn.addEventListener('click', () => {
        examDetailContainer.style.display = 'none';
        examListContainer.style.display = 'block';
        currentExam = null; // Limpiamos el estado
    });

    // Botón para iniciar el examen
    startExamBtn.addEventListener('click', () => {
        userKeyInput.value = ''; // Limpiamos el input
        userKeyModal.style.display = 'block';
        userKeyInput.focus();
    });

    cancelKeyBtn.addEventListener('click', () => {
        userKeyModal.style.display = 'none';
    });

    userKeyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        userKey = userKeyInput.value.trim();
        if (userKey) {
            userKeyModal.style.display = 'none';
            fetchAndStartExam(); // Si la clave es válida, comenzamos el examen
        }
    });

    // Botón para la siguiente pregunta
    nextQuestionBtn.addEventListener('click', handleNextQuestion);

    // Usamos delegación de eventos para el botón de resultados que se crea dinámicamente
    examTakingContainer.addEventListener('click', (e) => {
        if (e.target.id === 'back-to-details-btn') {
            // Volvemos a la vista de detalles
            examTakingContainer.style.display = 'none';
            examDetailContainer.style.display = 'block';
            // Volvemos a cargar la clasificación para que se actualice si la API lo soporta
            fetchExamDetails(currentExam.idExamen);
        }
    });

    // --- INICIALIZACIÓN ---
    // Carga los exámenes cuando la página está lista
    fetchExams();
});