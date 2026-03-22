
const API_BASE_URL = 'http://127.0.0.1:8000';

// Tab Switching Logic
function switchTab(tab) {
    const formInput = document.getElementById('form-input');
    const bulkUpload = document.getElementById('bulk-upload');
    const tabs = document.querySelectorAll('.tab-btn');
    
    const displayArea = document.getElementById('predict-display');
    const summaryText = document.getElementById('summary-text');
    const improvementText = document.getElementById('improvement-text');

    displayArea.innerHTML = `
        <div class="icon-circle"><i class="fas fa-graduation-cap"></i></div>
        <h3>Ready to Analyze</h3>
        <p style="color: #94a3b8;">${tab === 'form' ? 'Enter details and click analyze' : 'Upload a file to see batch results'}</p>
    `;
    summaryText.innerText = "Insights will appear here...";
    improvementText.innerText = "Suggestions will appear here...";

    if (tab === 'form') {
        formInput.classList.remove('hidden');
        bulkUpload.classList.add('hidden');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        formInput.classList.add('hidden');
        bulkUpload.classList.remove('hidden');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
}
const delay = ms => new Promise(res => setTimeout(res, ms));
// Individual Prediction Logic
async function generatePrediction() {
    const studentData = {
        name: document.getElementById('studentName').value,
        attendance: parseFloat(document.getElementById('attendance').value),
        midterm_marks: parseFloat(document.getElementById('midtermMarks').value),
        midterm_total: parseFloat(document.getElementById('midtermTotal').value),
        internal_marks: parseFloat(document.getElementById('internalMarks').value),
        internal_total: parseFloat(document.getElementById('internalTotal').value),
        study_time: parseFloat(document.getElementById('studyTime').value),
        backlogs: parseInt(document.getElementById('backlogs').value) || 0
    };

    if (!studentData.name || isNaN(studentData.midterm_marks) || isNaN(studentData.midterm_total)) {
        alert("Please fill in all student details.");
        return;
    }

    const display = document.getElementById('predict-display');
    const summaryText = document.getElementById('summary-text');
    const improvementText = document.getElementById('improvement-text');

    // --- COOL LOADING PHASE ---
    display.innerHTML = `
        <div class="loading-container">
            <div class="pulse-container">  
                <div class="pulse-bubble"></div>
                <div class="pulse-bubble"></div>
                <div class="pulse-bubble"></div>
            </div>
            <h3 id="form-loading-status" style="color: #3b82f6; margin-top: 20px;">Fetching Data...</h3>
        </div>
    `;

    try {
        const responsePromise = fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(studentData)
        });

        await delay(800);
        document.getElementById('form-loading-status').innerText = "Analyzing Performance...";
        
        const response = await responsePromise;
        const data = await response.json();

        await delay(800);
        document.getElementById('form-loading-status').innerText = "Calculating CGPA...";
        await delay(500);

        // --- RENDER SCREENSHOT STYLE RESULT ---
        const isStrong = data.status === 'Strong Learner';
        const themeColor = isStrong ? '#4ade80' : '#f87171';
        const bgColor = isStrong ? 'rgba(74, 222, 128, 0.05)' : 'rgba(248, 113, 113, 0.05)';

        display.innerHTML = `
            <div class="prediction-result-card" style="border: 2px solid ${themeColor}; background: ${bgColor};">
                <div class="result-check">
                    <i class="fas ${isStrong ? 'fa-check-circle' : 'fa-exclamation-circle'}" style="color: ${themeColor};"></i>
                </div>
                <div class="result-status" style="color: ${themeColor};">${data.status.toUpperCase()}</div>
                <div class="result-cgpa">${data.predicted_cgpa}</div>
                <div class="result-footer">Analysis for ${studentData.name}</div>
            </div>
        `;
        
        summaryText.innerText = data.summary;
        improvementText.innerText = data.improvement_suggestions;
        
    } catch (err) {
        display.innerHTML = `<h3 style="color: #f87171">Error</h3><p>Connection failed.</p>`;
    }
}
// Helper to create the loading delay


async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const displayArea = document.getElementById('predict-display');
    const summaryText = document.getElementById('summary-text');
    const improvementText = document.getElementById('improvement-text');
    
    // --- STAGE 1: INITIATE LOADING ANIMATION ---
    displayArea.innerHTML = `
        <div class="loading-container" style="text-align: center; padding: 50px;">
            <div class="pulse-container" style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px;">  
                <div class="pulse-bubble"></div>
                <div class="pulse-bubble"></div>
                <div class="pulse-bubble"></div>
            </div>
            <h3 id="loading-status" style="color: #3b82f6;">Reading Batch Data...</h3>
            <p id="loading-subtext" style="color: #94a3b8; font-size: 0.8rem;">Parsing uploaded file</p>
        </div>
    `;

    try {
        // Start the request
        const responsePromise = fetch(`${API_BASE_URL}/bulk-predict`, { method: 'POST', body: formData });

        // Stage 2: "Analyzing" phase (Visual only)
        await delay(1200);
        document.getElementById('loading-status').innerText = "Analyzing Patterns...";
        document.getElementById('loading-subtext').innerText = "Running predictive models on student records";

        const response = await responsePromise;
        const data = await response.json();

        // Stage 3: "Finalizing" phase (Visual only)
        await delay(1000);
        document.getElementById('loading-status').innerText = "Generating Insights...";
        document.getElementById('loading-subtext').innerText = "Finalizing improvement strategies";
        await delay(800);

        // --- STAGE 4: RESTORE FULL FUNCTIONALITY ---
        
        // 1. Sort by Subject (A-Z)
        data.table_data.sort((a, b) => a.subject.localeCompare(b.subject));

        // 2. Render the Table
        displayArea.innerHTML = `
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th class="sticky-name">NAME</th>
                            <th class="sticky-subject">SUBJECT</th>
                            <th style="text-align: center;">STATUS</th>
                            <th style="text-align: right;">GRADE</th>
                            <th>ATTENDANCE</th>
                            <th>BACKLOGS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.table_data.map(row => {
                            const isStrong = row.status === 'STRONG LEARNER';
                            return `
                            <tr>
                                <td class="sticky-name" style="font-weight: 600;">${row.name}</td>
                                <td class="sticky-subject" style="color: #94a3b8;">${row.subject}</td>
                                <td style="text-align: center;">
                                    <span style="padding: 4px 12px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; 
                                        background: ${isStrong ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}; 
                                        color: ${isStrong ? '#4ade80' : '#f87171'};">
                                        ${row.status}
                                    </span>
                                </td>
                                <td style="text-align: right; font-weight: bold; color: #3b82f6;">${row.grade}</td>
                                <td style="color: #94a3b8;">${row.attendance || 'N/A'}%</td>
                                <td style="color: #94a3b8;">${row.backlogs ?? '0'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;

        // 3. Render Deep Analysis: Performance Summary
        summaryText.innerHTML = `
            <div style="font-size: 0.9rem; color: #ffffff;">
                <p><strong style="color: #3b82f6;">Batch Overview:</strong></p>
                <p>• Avg Grade: <span style="color: #4ade80; font-weight: bold;">${data.summary.avg_grade}/10</span> | Total Students: <strong>${data.summary.total_students}</strong></p>
                <p style="margin-top: 15px;"><strong style="color: #3b82f6;">Subject Performance:</strong></p>
                ${data.summary.subject_performance.map(line => `<p style="margin: 4px 0; color: #94a3b8;">${line}</p>`).join('')}
            </div>`;

        // 4. Render Deep Analysis: Improvement Strategy
        improvementText.innerHTML = `
            <div style="font-size: 0.9rem; color: #ffffff;">
                <p>• <strong style="color: #3b82f6;">Priority:</strong> Improve passing rates in <span style="color: #f87171;">${data.strategy.priority_subject}</span>.</p>
                <p>• <strong style="color: #3b82f6;">Strategy:</strong> Assign mentors for peer-to-peer learning.</p>
                <p style="margin-top: 15px;"><strong style="color: #3b82f6;">Weak Learners by Subject:</strong></p>
                ${Object.entries(data.strategy.weak_learners).map(([sub, names]) => `
                    <p style="margin: 4px 0; color: #94a3b8;">• <strong>${sub}:</strong> ${names}</p>
                `).join('')}
            </div>`;

    } catch (err) {
        displayArea.innerHTML = `<div style="color: #f87171; padding: 20px;">Error: ${err.message}</div>`;
    }
}