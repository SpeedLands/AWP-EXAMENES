document.addEventListener('DOMContentLoaded', () => {
    // --- 1. DOM ELEMENT REFERENCES ---
    // Main view containers
    const examListContainer = document.getElementById('exam-list-container');
    const examDetailContainer = document.getElementById('exam-detail-container');
    const examTakingContainer = document.getElementById('exam-taking-container');

    // List view elements
    const examList = document.getElementById('exam-list');

    // Detail view elements
    const backToListBtn = document.getElementById('back-to-list-btn');
    const examDetailsContent = document.getElementById('exam-details-content');
    const classificationTableBody = document.getElementById('classification-table-body');
    const startExamBtn = document.getElementById('start-exam-btn');

    // "Take Exam" view elements
    const examTitleTaking = document.getElementById('exam-title-taking');
    const questionContainer = document.getElementById('question-container');
    const nextQuestionBtn = document.getElementById('next-question-btn');

    const userKeyModal = document.getElementById('user-key-modal');
    const userKeyForm = document.getElementById('user-key-form');
    const userKeyInput = document.getElementById('user-key-input');
    const cancelKeyBtn = document.getElementById('cancel-key-btn');

    // --- 2. APPLICATION STATE VARIABLES ---
    let currentExam = null; // Will store the details of the current exam
    let currentQuestions = []; // Array for the questions of the current exam
    let currentQuestionIndex = 0; // Index for the current question
    let userAnswers = []; // Array to store the user's answers
    let userKey = null; // User's key for the exam


    // --- 3. FUNCTIONS TO FETCH DATA (API) ---

    /**
     * Fetches and renders the list of available exams.
     * @returns {void}
     */
    const fetchExams = async () => {
        try {
            const response = await fetch('/awp/api/sync.php?scope=examenes_publicos');
            if (!response.ok) throw new Error('Error in server response');
            const exams = await response.json();
            renderExams(exams);
        } catch (error) {
            console.error('Error fetching exams:', error);
            examList.innerHTML = '<p>Error loading exams. Please try again later.</p>';
        }
    };

    /**
     * Fetches and renders the details of a specific exam.
     * @param {number} examId The ID of the exam to fetch.
     * @returns {void}
     */
    const fetchExamDetails = async (examId) => {
        try {
            // We make the two requests in parallel for more efficiency
            const [detailsResponse, classificationResponse] = await Promise.all([
                fetch(`/awp/api/sync.php?scope=examen&id=${examId}`),
                fetch(`/awp/api/sync.php?scope=clasificacion&idExamen=${examId}`)
            ]);

            currentExam = await detailsResponse.json(); // We save the exam details in the state
            const classification = await classificationResponse.json();

            renderExamDetails(currentExam);
            renderClassification(classification);

            // We switch to the details view
            examListContainer.style.display = 'none';
            examDetailContainer.style.display = 'block';
        } catch (error) {
            console.error('Error fetching exam details:', error);
        }
    };

    /**
     * Fetches the questions for the current exam and starts the exam.
     * @returns {void}
     */
    const fetchAndStartExam = async () => {
        if (!currentExam) return;
        try {
            const response = await fetch(`/awp/api/sync.php?scope=preguntas&examen_id=${currentExam.idExamen}`);
            currentQuestions = await response.json();
            if (!currentQuestions || currentQuestions.length === 0) {
                alert('This exam has no questions.');
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

    /**
     * Submits the exam results to the server.
     * @returns {void}
     */
    const submitExamResults = async () => {
        const payload = {
            clave: userKey,
            respuestas: userAnswers.map(answer => answer.answer_id)
        };

        // We show an optimistic message to the user immediately
        showFinalScore(); 

        // We check if the Service Worker and Background Sync are available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            // We save the data in IndexedDB and ask the SW to sync
            navigator.serviceWorker.ready.then(async (swRegistration) => {
                
                try {
                    // 1. Save the payload in IndexedDB for persistence.
                    // We use the global function that we export from idb-manager.js
                    await window.dbManager.saveSingleItemToDB('pending_submissions', payload);

                    // 2. Request a background sync.
                    // This tells the SW to try to send the data when there is a connection.
                    return swRegistration.sync.register('sync-exam-submissions');

                } catch (dbError) {
                    console.error('Error saving to IndexedDB, trying direct send:', dbError);
                    // If saving to the local DB fails (very rare), we try a direct send.
                    sendDataDirectly(payload);
                }

            }).then(() => {
                console.log('Background sync registered for exam submission.');
            }).catch(err => {
                // If the sync registration fails, we try a normal fetch as a fallback
                console.error('Background Sync registration failed, trying direct send:', err);
                sendDataDirectly(payload);
            });
        } else {
            // If there is no support for SW or Background Sync, we do a normal fetch
            console.log('Background Sync not supported, trying direct send.');
            sendDataDirectly(payload);
        }
    };

    /**
     * Sends the exam results directly to the server.
     * @param {object} payload The exam results to send.
     * @returns {void}
     */
    async function sendDataDirectly(payload) {
        try {
            const response = await fetch('/awp/api/sync.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'submit_examen', payload })
            });
            if (!response.ok) {
                console.error('Direct send failed.');
                // Here we could notify the user that their submission failed
            } else {
                console.log('Direct send successful.');
            }
        } catch (error) {
            console.error('Error in direct send:', error);
            // Notify the user that they are offline and their submission could not be made
        }
    }


    // --- 4. RENDER FUNCTIONS ---

    /**
     * Renders the list of exams.
     * @param {Array<object>} exams The list of exams to render.
     * @returns {void}
     */
    const renderExams = (exams) => {
        examList.innerHTML = ''; // We clear the list
        if (!exams || exams.length === 0) {
            examList.innerHTML = '<p>No exams available at this time.</p>';
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
                        <li><a href="#" class="button alt view-details-btn" data-id="${exam.idExamen}">View Details</a></li>
                    </ul>
                </section>
            `;
            examList.appendChild(examElement);
        });
    };

    /**
     * Renders the details of a specific exam.
     * @param {object} exam The exam to render.
     * @returns {void}
     */
    const renderExamDetails = (exam) => {
        examDetailsContent.innerHTML = `
            <h3>${exam.tituloexamen}</h3>
            <p>${exam.descripcion}</p>
        `;
    };

    /**
     * Renders the classification table.
     * @param {Array<object>} classification The classification data to render.
     * @returns {void}
     */
    const renderClassification = (classification) => {
        classificationTableBody.innerHTML = '';
        if (!classification || classification.length === 0) {
            classificationTableBody.innerHTML = '<tr><td colspan="4">No results for this exam yet. Be the first!</td></tr>';
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
     * Renders the current question.
     * @returns {void}
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


    // --- 5. UI LOGIC AND EXAM FLOW ---

    /**
     * Handles the next question button click.
     * @returns {void}
     */
    const handleNextQuestion = () => {
        const selectedOption = document.querySelector('input[name="answer"]:checked');
        if (!selectedOption) {
            alert('Please select an answer.');
            return;
        }
        // **MODIFIED**: We save the answer ID, not just the text
        userAnswers.push({
            question_id: currentQuestions[currentQuestionIndex].id,
            answer_text: selectedOption.value,
            answer_id: selectedOption.dataset.answerId 
        });

        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            renderQuestion();
        } else {
            submitExamResults(); // When finished, we send the results
        }
    };

    /**
     * Shows the final score.
     * @returns {void}
     */
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
            <h2>Exam Finished</h2>
            <p>Thank you for participating, <strong>${userKey}</strong>!</p>
            <p>Your score is: <strong>${score} out of ${currentQuestions.length}</strong></p>
            <p>Percentage of correct answers: <strong>${percentage.toFixed(2)}%</strong></p>
            <button id="back-to-details-btn" class="button">View Updated Classification Table</button>
        `;
    };

    // --- 6. EVENT LISTENERS ---

    // We use event delegation on the exam list to handle clicks
    examList.addEventListener('click', (e) => {
        const detailsButton = e.target.closest('.view-details-btn');
        if (detailsButton) {
            e.preventDefault();
            fetchExamDetails(detailsButton.dataset.id);
        }
    });

    // Button to return to the list from the details
    backToListBtn.addEventListener('click', () => {
        examDetailContainer.style.display = 'none';
        examListContainer.style.display = 'block';
        currentExam = null; // We clear the state
    });

    // Button to start the exam
    startExamBtn.addEventListener('click', () => {
        userKeyInput.value = ''; // We clear the input
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
            fetchAndStartExam(); // If the key is valid, we start the exam
        }
    });

    // Button for the next question
    nextQuestionBtn.addEventListener('click', handleNextQuestion);

    // We use event delegation for the results button that is created dynamically
    examTakingContainer.addEventListener('click', (e) => {
        if (e.target.id === 'back-to-details-btn') {
            // We return to the details view
            examTakingContainer.style.display = 'none';
            examDetailContainer.style.display = 'block';
            // We reload the classification to update it if the API supports it
            fetchExamDetails(currentExam.idExamen);
        }
    });

    // --- INITIALIZATION ---
    // Loads the exams when the page is ready
    fetchExams();
});
