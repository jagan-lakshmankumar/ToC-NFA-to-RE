document.addEventListener("DOMContentLoaded", () => {
    const btnConvert = document.getElementById("btn-convert");
    const btnReset = document.getElementById("btn-reset");
    const inputSection = document.getElementById("input-section");
    const resultsSection = document.getElementById("results-section");
    const errorBox = document.getElementById("error-message");
    
    // Set default transitions for convenience
    document.getElementById("transitions").value = "q0, q1, a\nq1, q2, b\nq1, q1, c";

    btnConvert.addEventListener("click", () => {
        const numStates = parseInt(document.getElementById("num-states").value);
        let startState = document.getElementById("start-state").value.trim();
        let rawFinal = document.getElementById("final-state").value.trim();
        let finalStates = rawFinal.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        let rawAlphabet = document.getElementById("alphabet").value.trim();
        let alphabetVars = rawAlphabet.split(',').map(s => s.trim()).filter(s => s.length > 0);
        
        const rawTransitions = document.getElementById("transitions").value;

        // Validation
        if (isNaN(numStates) || numStates < 2 || numStates > 6) {
            showError("Please enter a valid number of states between 2 and 6.");
            return;
        }
        if (!startState) {
            showError("Start state cannot be empty.");
            return;
        }
        if (finalStates.length < 1 || finalStates.length > 3) {
            showError("Please specify 1 to 3 final states (comma separated).");
            return;
        }
        if (finalStates.includes(startState)) {
             showError("For this conceptual simulation, start and final states should be distinctly configured.");
             return;
        }
        if (alphabetVars.length === 0) {
             showError("Please define the alphabet (\u03A3).");
             return;
        }

        const transLines = rawTransitions.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (transLines.length === 0) {
            showError("Please enter at least one transition.");
            return;
        }

        // Parse Transitions
        let adj = {}; 
        let allSeenStates = new Set();
        
        let parseError = null;
        transLines.forEach((line, index) => {
            const parts = line.split(',');
            if (parts.length !== 3) {
                 parseError = `Line ${index + 1} does not have exactly 3 parts: "${line}"`;
                 return;
            }
            const src = parts[0].trim();
            const dst = parts[1].trim();
            const symbol = parts[2].trim();
            
            if (!alphabetVars.includes(symbol)) {
                 parseError = `Line ${index + 1}: Symbol '${symbol}' is not defined in the alphabet (\u03A3).`;
                 return;
            }
            
            allSeenStates.add(src);
            allSeenStates.add(dst);

            if (!adj[src]) adj[src] = {};
            if (adj[src][dst]) {
                 adj[src][dst] = `(${adj[src][dst]} | ${symbol})`;
            } else {
                 adj[src][dst] = symbol;
            }
        });

        if (parseError) {
             showError(parseError);
             return;
        }
        
        allSeenStates.add(startState);
        finalStates.forEach(f => allSeenStates.add(f));
        
        if (allSeenStates.size > numStates) {
             showError(`You specified ${numStates} states, but referenced ${allSeenStates.size} distinct states: ${Array.from(allSeenStates).join(', ')}.`);
             return;
        }
        
        hideError();

        // Execution Step
        executeStateElimination(startState, finalStates, Array.from(allSeenStates), adj);
    });

    btnReset.addEventListener("click", () => {
        resultsSection.classList.add("hidden");
        inputSection.classList.remove("hidden");
        document.getElementById("steps-container").innerHTML = "";
    });

    function showError(msg) {
        errorBox.textContent = msg;
        errorBox.classList.remove("hidden");
    }

    function hideError() {
        errorBox.classList.add("hidden");
    }
    
    // Formatting helpers
    function wrapExp(exp) {
        if (!exp || exp === "ε") return exp;
        if (exp.length === 1) return exp;
        return `(${exp})`;
    }

    function cleanConcat(r1, r2) {
        if (!r1) return r2 || "";
        if (!r2) return r1 || "";
        if (r1 === "ε" && r2 === "ε") return "ε";
        if (r1 === "ε") return r2;
        if (r2 === "ε") return r1;
        return r1 + r2;
    }

    function executeStateElimination(start, finalStates, originalStates, adj) {
        const stepsContainer = document.getElementById("steps-container");
        stepsContainer.innerHTML = "";
        
        const SYS_START = "START";
        const SYS_FINAL = "ACCEPT";

        let activeStates = [...originalStates, SYS_START, SYS_FINAL];
        let intermediates = [...originalStates]; // We eliminate ALL original states implicitly!
        
        // Initialize connections
        activeStates.forEach(s => {
             if (!adj[s]) adj[s] = {};
        });
        
        // Add epsilon transitions from Synthetic Start and to Synthetic Final
        adj[SYS_START][start] = "ε";
        finalStates.forEach(f => {
             adj[f][SYS_FINAL] = "ε";
        });

        const initialStep = document.createElement("div");
        initialStep.className = "step-item";
        initialStep.innerHTML = `
            <div class="step-header">Initial Configuration & Synthetic States</div>
            <div class="step-body">
                <p>Original States: <span class="math">${originalStates.join(', ')}</span></p>
                <p>To handle multiple final states uniformly, we add a synthetic <span class="math">START</span> state and <span class="math">ACCEPT</span> state with &epsilon; transitions.</p>
                <p>New Internal Target states to eliminate: <span class="math">${intermediates.join(', ')}</span></p>
            </div>
        `;
        stepsContainer.appendChild(initialStep);

        intermediates.forEach(elim => {
            let stepText = `<div class="step-header">Eliminating State <span class="math">${elim}</span></div><div class="step-body">`;
            
            let selfLoop = adj[elim][elim] ? wrapExp(adj[elim][elim]) + "*" : "";
            let changesMade = false;
            
            activeStates.forEach(src => {
                 if (src === elim) return;
                 if (adj[src] && adj[src][elim]) {
                     activeStates.forEach(dst => {
                         if (dst === elim) return;
                         if (adj[elim] && adj[elim][dst]) {
                              let pIn = wrapExp(adj[src][elim]);
                              let pOut = wrapExp(adj[elim][dst]);
                              
                              let combined = cleanConcat(cleanConcat(pIn, selfLoop), pOut);
                              if (!combined) combined = "ε";
                              
                              stepText += `<p>Path map: <span class="math">${src} &rarr; ${elim} &rarr; ${dst}</span></p>`;
                              stepText += `<p>Generated sequence: <span class="math">${combined}</span></p>`;
                              
                              if (adj[src][dst]) {
                                   adj[src][dst] = `(${adj[src][dst]} | ${combined})`;
                                   stepText += `<p>Merging path <span class="math">${src} &rarr; ${dst}</span> &Rightarrow; <span class="math">${adj[src][dst]}</span></p>`;
                              } else {
                                   adj[src][dst] = combined;
                              }
                              changesMade = true;
                         }
                     });
                 }
            });
            
            if (!changesMade) {
                  stepText += `<p>No valid through-paths traversing <span class="math">${elim}</span> were utilized. Removed safely.</p>`;
            }
            
            // Clean up: remove from activeStates and delete matrices
            activeStates = activeStates.filter(s => s !== elim);
            delete adj[elim];
            activeStates.forEach(s => {
                 if(adj[s]) delete adj[s][elim];
            });
            
            stepText += `</div>`;
            const stepDiv = document.createElement("div");
            stepDiv.className = "step-item";
            stepDiv.innerHTML = stepText;
            stepsContainer.appendChild(stepDiv);
        });

        let finalRegex = adj[SYS_START][SYS_FINAL] || "None (No valid path)";
        
        const finalStep = document.createElement("div");
        finalStep.className = "step-item";
        finalStep.innerHTML = `<div class="step-header">Final Calculation</div><div class="step-body"><p>All original states eliminated. The graph reduces directly to synthetic <span class="math">START &rarr; ACCEPT</span>.</p></div>`;
        stepsContainer.appendChild(finalStep);

        document.getElementById("final-re").textContent = finalRegex;
        
        inputSection.classList.add("hidden");
        resultsSection.classList.remove("hidden");
    }
});
