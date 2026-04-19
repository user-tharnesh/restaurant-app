const selectedTags = new Set();

window.toggleTag = function(btn) {
    btn.classList.toggle('active');
    const tag = btn.innerText.replace(/[^\w\s&]/g, '').trim(); 
    if (btn.classList.contains('active')) {
        selectedTags.add(tag);
    } else {
        selectedTags.delete(tag);
    }
}

window.findFlavor = async function() {
    if (selectedTags.size === 0) {
        alert("Delicious choices! Please select at least one craving first.");
        return;
    }

    const btn = document.getElementById('btn-find-flavor');
    const resultDiv = document.getElementById('ai-flavor-result');
    const nameEl = document.getElementById('ai-dish-name');
    const descEl = document.getElementById('ai-dish-desc');

    btn.innerText = "Consulting AI Chef... 👨‍🍳";
    btn.disabled = true;
    resultDiv.style.display = 'none';

    try {
        const response = await fetch('/api/ai/flavor-profiler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: Array.from(selectedTags) })
        });
        const result = await response.json();
        
        if (result.success && result.data) {
            resultDiv.style.display = 'block';
            nameEl.innerText = result.data.recommendedDish || "Error retrieving dish";
            
            const desc = result.data.description || "The AI Chef forgot the description!";
            descEl.innerText = desc;
            
            // Speak it aloud!
            window.speechSynthesis.cancel();
            const msg = new SpeechSynthesisUtterance("I recommend the " + nameEl.innerText + ". " + desc);
            window.speechSynthesis.speak(msg);
            
        } else {
            alert('AI Error: ' + (result.message || 'Make sure API Key is configured.'));
        }
    } catch(err) {
        alert('Failed to connect to the AI Chef.');
    } finally {
        btn.innerText = "Find My Perfect Dish ✨";
        btn.disabled = false;
    }
}
