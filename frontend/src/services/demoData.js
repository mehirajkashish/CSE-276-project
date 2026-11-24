/**
 * Demo Mode Dataset for StudyMind AI
 * Provides rich, realistic academic datasets, pre-indexed vector documents,
 * interactive conversations with grounded RAG answers and source citations,
 * plus flashcards, quizzes, and summaries.
 */

export const DEMO_USER = {
  id: 'demo-user-101',
  full_name: 'Alex Academic',
  email: 'demo.scholar@studymind.ai',
  role: 'student',
  is_demo: true,
};

export const DEMO_DOCUMENTS = [
  {
    id: 'demo-doc-cs101',
    filename: 'CS101_Deep_Learning_&_Neural_Architectures.pdf',
    file_size: 3542000,
    upload_date: new Date(Date.now() - 86400000 * 2).toISOString(),
    processing_status: 'ready',
    total_pages: 36,
    total_chunks: 42,
  },
  {
    id: 'demo-doc-che110',
    filename: 'CHE110_Environmental_Disaster_Management.pdf',
    file_size: 4810000,
    upload_date: new Date(Date.now() - 86400000 * 4).toISOString(),
    processing_status: 'ready',
    total_pages: 87,
    total_chunks: 86,
  },
  {
    id: 'demo-doc-eng204',
    filename: 'ENG204_Quantum_Mechanics_&_Wave_Equations.pdf',
    file_size: 5120000,
    upload_date: new Date(Date.now() - 86400000 * 6).toISOString(),
    processing_status: 'ready',
    total_pages: 52,
    total_chunks: 60,
  },
];

export const DEMO_CONVERSATIONS = [
  {
    id: 'demo-conv-1',
    title: 'Attention Mechanisms & Transformer Encoders',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'What is the formula for scaled dot-product attention and why do we scale by sqrt(d_k)?',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content:
          'Great question! **Scaled Dot-Product Attention** is the core engine behind modern Transformers. Here is the intuitive breakdown:\n\n' +
          '### 📐 The Mathematical Formula\n' +
          '$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\n' +
          '### 💡 Why do we divide by $\\sqrt{d_k}$?\n' +
          'Think of dot products like volume knobs. When the vector dimension $d_k$ is large, computing dot products causes the numbers to grow huge in magnitude.\n\n' +
          '1. **The Problem:** When numbers fed into the `softmax` function become extremely large, the output probabilities collapse into 0s and 1s, causing gradients to practically vanish to zero. The model stops learning!\n' +
          '2. **The Solution:** Assuming components of $Q$ and $K$ are independent with mean 0 and variance 1, their dot product has variance equal to $d_k$. Dividing by $\\sqrt{d_k}$ scales the variance right back down to 1, keeping backpropagation stable and fast.',
        timestamp: new Date(Date.now() - 3600000 * 2.9).toISOString(),
        sources: [
          {
            document_id: 'demo-doc-cs101',
            filename: 'CS101_Deep_Learning_&_Neural_Architectures.pdf',
            page: 14,
            page_number: 14,
            text: 'Scaled dot-product attention computes softmax(Q * K^T / sqrt(d_k)) * V to prevent vanishing gradients during backward propagation.',
          },
        ],
      },
    ],
  },
  {
    id: 'demo-conv-2',
    title: 'Disaster Management & Radiation Hazards',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    messages: [
      {
        id: 'msg-3',
        role: 'user',
        content: 'Summarize the primary causes of environmental radiation hazards.',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content:
          'Here is a clear, student-friendly breakdown of environmental radiation hazards from your course material:\n\n' +
          'Environmental radiation is divided into two distinct origins:\n\n' +
          '### 🌿 1. Natural Sources (Cosmic & Terrestrial)\n' +
          '- **Cosmic Radiation:** Energetic subatomic particles from space and solar flares colliding with Earth’s upper atmosphere.\n' +
          '- **Radon-222 Gas:** An odorless radioactive noble gas produced by the natural decay of uranium in granites and bedrock. It seeps into basements and represents the single largest natural contributor to human inhalation dose.\n' +
          '- **Soil & Food Radionuclides:** Trace amounts of Potassium-40 and Thorium present in rock formations and water systems.\n\n' +
          '### 🏭 2. Anthropogenic Sources (Human-Induced)\n' +
          '- **Nuclear Facilities:** Reactor core incidents, accidental cooling loop leaks, and spent fuel storage failures.\n' +
          '- **Medical Applications:** Diagnostic radiography (X-rays, CT scanners) and therapeutic radioisotopes.\n' +
          '- **Industrial & Research Waste:** Non-destructive material testing equipment and unshielded academic tracer isotopes.',
        timestamp: new Date(Date.now() - 86400000 + 5000).toISOString(),
        sources: [
          {
            document_id: 'demo-doc-che110',
            filename: 'CHE110_Environmental_Disaster_Management.pdf',
            page: 46,
            page_number: 46,
            text: 'Natural sources: Cosmic rays, Radon-222, terrestrial isotopes. Anthropogenic sources: Nuclear power plants, nuclear accidents, medical X-rays.',
          },
        ],
      },
    ],
  },
];

export const DEMO_STATS = {
  total_documents: 3,
  total_chunks: 188,
  total_questions: 28,
  conversations_count: 3,
  recent_documents: DEMO_DOCUMENTS,
  recent_conversations: DEMO_CONVERSATIONS.map((c) => ({
    id: c.id,
    title: c.title,
    created_at: c.created_at,
  })),
};

export const DEMO_FLASHCARDS = [
  {
    id: 1,
    question: 'What is the role of the Softmax function in Attention Mechanisms?',
    answer:
      'Softmax transforms raw compatibility dot-products into a smooth probability distribution (non-negative weights summing to 1). This determines how much focus the model places on each token.',
    key_concept: 'Attention Weights',
    category: 'Deep Learning',
    source: 'CS101, Page 14',
    page_number: 14,
  },
  {
    id: 2,
    question: 'What is Radon-222 and why is it dangerous in disaster management?',
    answer:
      'Radon-222 is an odorless, colorless radioactive noble gas from uranium decay in soil and bedrock. When inhaled, its alpha decay particles damage bronchial tissues, making it a primary environmental cancer hazard.',
    key_concept: 'Radon Hazards',
    category: 'Environmental Chemistry',
    source: 'CHE110, Page 46',
    page_number: 46,
  },
  {
    id: 3,
    question: 'What does the squared wave function |Ψ(x,t)|² represent physically?',
    answer:
      'Born\'s interpretation states that |Ψ(x,t)|² represents the probability density of finding a particle at coordinate x at time t. The total integral over all space must equal 1.',
    key_concept: 'Probability Density',
    category: 'Quantum Physics',
    source: 'ENG204, Page 8',
    page_number: 8,
  },
  {
    id: 4,
    question: 'What is the key difference between Self-Attention and Cross-Attention?',
    answer:
      'In Self-Attention, Query (Q), Key (K), and Value (V) all originate from the same sequence. In Cross-Attention, Query comes from the decoder while Keys and Values come from the encoder sequence.',
    key_concept: 'Cross-Attention',
    category: 'Deep Learning',
    source: 'CS101, Page 18',
    page_number: 18,
  },
  {
    id: 5,
    question: 'What are the three core phases in comprehensive Disaster Management?',
    answer:
      '1. Pre-Disaster (Risk mapping, early warnings, mitigation)\n2. During-Disaster (Emergency evacuation, rescue, relief)\n3. Post-Disaster (Rehabilitation, reconstruction, decontamination).',
    key_concept: 'Disaster Lifecycle',
    category: 'Disaster Management',
    source: 'CHE110, Page 2',
    page_number: 2,
  },
  {
    id: 6,
    question: 'State the Heisenberg Uncertainty Principle mathematically and conceptually.',
    answer:
      'Δx · Δp ≥ ℏ / 2. You cannot simultaneously measure both the position and momentum of a quantum particle with arbitrary precision—the act of measurement itself introduces quantum uncertainty.',
    key_concept: 'Quantum Uncertainty',
    category: 'Quantum Physics',
    source: 'ENG204, Page 12',
    page_number: 12,
  },
];

export const DEMO_QUIZ = [
  {
    id: 1,
    question: 'Why is the scaling factor 1/√d_k used in Scaled Dot-Product Attention?',
    options: [
      { id: 'A', text: 'To convert one-dimensional vectors into diagonal square matrices' },
      { id: 'B', text: 'To prevent large dot-products from pushing the softmax function into vanishing gradient regions' },
      { id: 'C', text: 'To enforce strict causal unidirectional autoregressive masking' },
      { id: 'D', text: 'To reduce the total number of trainable parameter weights by half' },
    ],
    correct_option_id: 'B',
    explanation:
      'Large dot product values push softmax activations into regions with vanishingly small gradients. Dividing by √d_k normalizes the score variance back to 1.',
    page_number: 14,
  },
  {
    id: 2,
    question: 'Which radionuclide is the primary natural contributor to background inhalation radiation?',
    options: [
      { id: 'A', text: 'Radon-222 gas originating from uranium decay chains in soil and rocks' },
      { id: 'B', text: 'Cesium-137 produced during nuclear reactor fission events' },
      { id: 'C', text: 'Cobalt-60 utilized in industrial radiography testing' },
      { id: 'D', text: 'Strontium-90 accumulating in groundwater runoff' },
    ],
    correct_option_id: 'A',
    explanation:
      'Radon-222 is an odorless radioactive gas arising from natural decay in rock formations, accounting for over 50% of human natural background radiation exposure.',
    page_number: 46,
  },
  {
    id: 3,
    question: 'In the time-dependent Schrödinger equation, what physical observable does the Hamiltonian operator H represent?',
    options: [
      { id: 'A', text: 'Total mechanical energy of the system (Kinetic Energy + Potential Energy)' },
      { id: 'B', text: 'Linear momentum vector in three spatial dimensions' },
      { id: 'C', text: 'The wave propagation velocity through a dielectric medium' },
      { id: 'D', text: 'The intrinsic quantum electron spin magnetic moment' },
    ],
    correct_option_id: 'A',
    explanation:
      'The Hamiltonian operator H = - (ℏ²/2m)∇² + V corresponds to the total mechanical energy of the quantum system.',
    page_number: 8,
  },
  {
    id: 4,
    question: 'What is the main architectural benefit of Multi-Head Attention over Single-Head Attention?',
    options: [
      { id: 'A', text: 'It completely eliminates the need for matrix multiplications' },
      { id: 'B', text: 'It allows the model to jointly attend to information from different representation subspaces at different positions' },
      { id: 'C', text: 'It forces the model to process tokens in strictly sequential order' },
      { id: 'D', text: 'It removes the need for residual skip connections' },
    ],
    correct_option_id: 'B',
    explanation:
      'Multi-head attention projects queries, keys, and values h times, allowing the model to attend to grammatical, semantic, and positional aspects simultaneously.',
    page_number: 16,
  },
  {
    id: 5,
    question: 'In disaster mitigation, what is the primary purpose of Potassium Iodide (KI) distribution?',
    options: [
      { id: 'A', text: 'To neutralize gamma ray penetration through concrete bunkers' },
      { id: 'B', text: 'To saturate the thyroid gland and block absorption of radioactive Iodine-131' },
      { id: 'C', text: 'To purify municipal drinking water contaminated by radon gas' },
      { id: 'D', text: 'To accelerate cellular DNA repair after whole-body exposure' },
    ],
    correct_option_id: 'B',
    explanation:
      'Potassium Iodide floods the thyroid with stable iodine, preventing the uptake of dangerous radioactive Iodine-131 released during nuclear accidents.',
    page_number: 52,
  },
];

export const DEMO_SUMMARY = `# 📖 Comprehensive Study Guide: Multi-Disciplinary Academic Corpus

**Textbooks Analyzed:** Deep Learning Architectures • Environmental Disaster Management • Quantum Wave Equations  
**Coverage:** 175 Total Pages | 188 Semantic Vector Segments | **Confidence:** Grounded RAG Verified

---

## 🎯 Executive Overview & Study Objectives
This study guide synthesizes key academic principles across your uploaded materials. Focus on understanding the **underlying mechanisms** rather than rote memorization:
1. **Machine Learning:** How Transformers replace recurrence with scaled dot-product attention.
2. **Environmental Science:** How to identify, classify, and mitigate natural vs. industrial hazards.
3. **Quantum Mechanics:** How the wave function determines particle probability distributions.

---

## 🏛️ Essential Formulas & Conceptual Proofs

### 1. Scaled Dot-Product Attention *(CS101, Page 14)*
$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$
- **Intuition:** $QK^T$ evaluates how relevant every token is to every other token.
- **Why $\\sqrt{d_k}$?** Dividing by the square root of the projection dimension normalizes score variance, preventing vanishing gradients during training.

### 2. Time-Dependent Schrödinger Wave Equation *(ENG204, Page 8)*
$$i\\hbar \\frac{\\partial}{\\partial t} \\Psi(x,t) = \\left[ -\\frac{\\hbar^2}{2m}\\frac{\\partial^2}{\\partial x^2} + V(x,t) \\right] \\Psi(x,t)$$
- The squared amplitude $|\\Psi(x,t)|^2$ describes the probability density of observing the particle at position $x$.
- Normalization ensures the particle exists somewhere in the universe: $\\int |\\Psi|^2 dx = 1$.

---

## 📋 Structured Taxonomies & Classifications

### Radiation Hazard Origins *(CHE110, Page 46)*
- **Natural Origins:** Cosmic rays (space-borne) and terrestrial isotopes (e.g., Radon-222 gas in granites).
- **Anthropogenic Origins:** Nuclear power incidents, radiography facilities, and medical diagnostic isotopes.
- **Management Protocol:** Evacuation radius, thyroid blocking using Potassium Iodide, and topsoil removal.

---

## ⚡ High-Yield Exam Review & Must-Know Takeaways
1. **Self-Attention vs. Cross-Attention:** Self-attention connects tokens within the same sequence; cross-attention bridges encoder outputs to decoder inputs.
2. **Radon Mitigation:** Active sub-slab depressurization and proper basement ventilation prevent radon accumulation.
3. **Born Rule:** Physical measurement collapses quantum superposition into a single observable eigenvalue.

> 💡 **Tutor Tip:** Test yourself using the **3D Flashcards** and **Exam Quiz** tabs to lock in active recall before test day!`;

/**
 * Generates an intelligent, humanized, simulated RAG answer in Demo Mode
 */
export function generateDemoChatResponse(question) {
  const clean = question.toLowerCase();

  if (clean.includes('attention') || clean.includes('transformer') || clean.includes('deep learning')) {
    return {
      answer:
        'Great question! **Attention mechanisms** completely transformed how AI processes language. Here is the intuitive breakdown:\n\n' +
        '### 🧠 How It Works in Plain English\n' +
        'Before attention, models tried to squash an entire sentence into a single vector—like trying to remember a whole textbook page in one breath! Attention lets the model look back at the exact words that matter for each token:\n\n' +
        '- **Queries (Q):** What the current token is looking for.\n' +
        '- **Keys (K):** What each candidate token offers.\n' +
        '- **Values (V):** The actual information conveyed.\n\n' +
        '### 📐 The Mathematical Formulation\n' +
        '$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$\n\n' +
        'The term $\\frac{1}{\\sqrt{d_k}}$ is crucial: it prevents dot products from growing too large, ensuring gradients remain healthy during training.',
      grounded: true,
      sources: [
        {
          document_id: 'demo-doc-cs101',
          filename: 'CS101_Deep_Learning_&_Neural_Architectures.pdf',
          page: 14,
          page_number: 14,
        },
      ],
    };
  }

  if (clean.includes('disaster') || clean.includes('radiation') || clean.includes('radon')) {
    return {
      answer:
        'Here is a structured, student-friendly explanation of environmental radiation from your course notes:\n\n' +
        '### 🌿 1. Natural Radiation Hazards\n' +
        '- **Radon-222:** The most common natural hazard. It is a radioactive gas released from rocks and soil that accumulates in enclosed buildings.\n' +
        '- **Cosmic Rays:** High-energy particles from space that penetrate the atmosphere.\n\n' +
        '### 🏭 2. Human-Induced Radiation Hazards\n' +
        '- Reactor coolant leaks, industrial radiography sources, and unshielded medical X-ray equipment.\n\n' +
        '### 🛡️ Safety & Mitigation Protocols\n' +
        '1. **Pre-Disaster:** Continuous radon monitoring and building sub-slab ventilation.\n' +
        '2. **Emergency Phase:** Potassium Iodide (KI) pills to protect the thyroid gland from radioactive Iodine-131.\n' +
        '3. **Post-Disaster:** Soil skimming and water purification.',
      grounded: true,
      sources: [
        {
          document_id: 'demo-doc-che110',
          filename: 'CHE110_Environmental_Disaster_Management.pdf',
          page: 46,
          page_number: 46,
        },
      ],
    };
  }

  if (clean.includes('quantum') || clean.includes('schrodinger') || clean.includes('wave')) {
    return {
      answer:
        'Here is the intuitive explanation for the **Schrödinger Wave Equation**:\n\n' +
        'In classical physics, Newton\'s laws tell you where a baseball is at any moment. In quantum mechanics, particles behave like waves, so we use the wave function $\\Psi(x,t)$:\n\n' +
        '$$i\\hbar \\frac{\\partial}{\\partial t} \\Psi(x,t) = \\hat{H}\\Psi(x,t)$$\n\n' +
        '- **The Core Insight:** You cannot pin down an exact point—instead, $|\\Psi(x,t)|^2$ gives you the probability of finding the particle there.\n' +
        '- **Conservation of Probability:** The total probability across all space must equal 1 (the particle must be somewhere!).',
      grounded: true,
      sources: [
        {
          document_id: 'demo-doc-eng204',
          filename: 'ENG204_Quantum_Mechanics_&_Wave_Equations.pdf',
          page: 8,
          page_number: 8,
        },
      ],
    };
  }

  if (clean.includes('hi') || clean.includes('hello') || clean.includes('hey')) {
    return {
      answer:
        'Hello there! 👋 I\'m your **StudyMind AI study buddy**.\n\n' +
        'I\'m here to help you truly understand your course materials, break down tough concepts, and prepare for exams with confidence.\n\n' +
        'What topic or chapter would you like to explore today?',
      grounded: false,
      sources: [],
    };
  }

  // Default smart grounded response
  return {
    answer:
      `Here is a clear breakdown for **"${question}"** based on your uploaded course materials:\n\n` +
      '- **Key Intuition:** This topic is addressed in your course notes with structured mathematical definitions and practical applications.\n' +
      '- **Takeaway:** You can review the exact pages in the **Document Viewer** or test your active recall using the **Study Toolkit**.\n\n' +
      'Feel free to ask a follow-up question or request an intuitive analogy!',
    grounded: true,
    sources: [
      {
        document_id: 'demo-doc-cs101',
        filename: 'CS101_Deep_Learning_&_Neural_Architectures.pdf',
        page: 14,
        page_number: 14,
      },
    ],
  };
}

export const DEMO_MIND_MAP = {
  document_id: 'demo-doc-cs101',
  filename: 'CS101_Deep_Learning_&_Neural_Architectures.pdf',
  root_topic: 'Neural Networks & Transformers',
  mind_map: {
    name: 'Deep Learning & Transformers',
    children: [
      {
        id: 'b1',
        name: 'Foundations & Architectures',
        children: [
          { id: 'b1_0', name: 'Feedforward Networks & Perceptrons' },
          { id: 'b1_1', name: 'Convolutional Filters (CNNs)' },
          { id: 'b1_2', name: 'Recurrent State Machines (RNNs & LSTMs)' }
        ]
      },
      {
        id: 'b2',
        name: 'Attention Mechanisms',
        children: [
          { id: 'b2_0', name: 'Scaled Dot-Product Attention (Q, K, V)' },
          { id: 'b2_1', name: 'Multi-Head Attention Projections' },
          { id: 'b2_2', name: 'Positional Encodings (Sinusoidal & RoPE)' }
        ]
      },
      {
        id: 'b3',
        name: 'Optimization & Regularization',
        children: [
          { id: 'b3_0', name: 'AdamW & Cosine Learning Rate Decay' },
          { id: 'b3_1', name: 'LayerNorm vs RMSNorm' },
          { id: 'b3_2', name: 'Dropout & Weight Decay' }
        ]
      },
      {
        id: 'b4',
        name: 'High-Yield Exam Applications',
        children: [
          { id: 'b4_0', name: 'Vanishing Gradient Mitigation' },
          { id: 'b4_1', name: 'Cross-Entropy Loss Computations' },
          { id: 'b4_2', name: 'Inference Latency & KV Cache' }
        ]
      }
    ]
  }
};

export const DEMO_PRACTICE_QUESTIONS = [
  {
    type: 'Short Answer (5 Marks)',
    question: "Define 'Scaled Dot-Product Attention' and explain why scaling by 1/sqrt(d_k) is required.",
    solution: "Expected Answer: Scaled dot-product attention computes Attention(Q, K, V) = softmax(QK^T / sqrt(d_k))V. The scaling factor prevents dot products from growing excessively large for large dimensions d_k, preventing softmax gradients from vanishing.",
    difficulty: 'Easy',
    page: 14
  },
  {
    type: 'Descriptive / Architecture (8 Marks)',
    question: 'Compare and contrast Pre-Layer Normalization (Pre-LN) with Post-Layer Normalization (Post-LN) in Transformer architectures.',
    solution: 'Expected Answer: Pre-LN applies normalization before the self-attention and MLP blocks, providing a direct gradient highway through the residual stream, which stabilizes deep network training without requiring warm-up schedules.',
    difficulty: 'Medium',
    page: 22
  },
  {
    type: 'Analytical (10 Marks)',
    question: 'Derive the time and memory complexity of the standard self-attention operation with respect to sequence length N.',
    solution: 'Expected Answer: Computing QK^T requires O(N^2 * d) operations and stores an N x N attention matrix in memory, yielding O(N^2) space complexity, which presents a bottleneck for long contexts.',
    difficulty: 'Hard',
    page: 28
  }
];

export const DEMO_CODING_TUTOR = {
  topic: 'Scaled Dot-Product Attention',
  language: 'python',
  content: `### 💻 Coding Tutor: **Scaled Dot-Product Attention** in Python

#### 🧠 1. Core Algorithmic Intuition
Scaled Dot-Product Attention measures the compatibility between Query vectors and Key vectors to compute a weighted sum of Value vectors. We scale the dot products by $\\frac{1}{\\sqrt{d_k}}$ to stabilize numerical gradients before applying Softmax.

#### ⚡ 2. Clean PyTorch Implementation
\`\`\`python
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    """
    Computes Scaled Dot-Product Attention.
    Args:
        Q: (batch_size, num_heads, seq_len_q, d_k)
        K: (batch_size, num_heads, seq_len_k, d_k)
        V: (batch_size, num_heads, seq_len_k, d_v)
        mask: optional mask tensor of shape (batch_size, 1, 1, seq_len_k)
    """
    d_k = Q.size(-1)
    
    # Step 1: Compute raw dot-product scores (Q @ K^T) / sqrt(d_k)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d_k ** 0.5)
    
    # Step 2: Apply optional causal / padding mask
    if mask is not None:
        scores = scores.masked_fill(mask == 0, -1e9)
        
    # Step 3: Softmax along last dimension to get attention weights
    attn_weights = F.softmax(scores, dim=-1)
    
    # Step 4: Multiply by Value vectors
    output = torch.matmul(attn_weights, V)
    return output, attn_weights
\`\`\`

#### ⏱️ 3. Complexity Analysis
- **Time Complexity:** $O(B \\cdot H \\cdot N^2 \\cdot d)$ where $N$ is sequence length.
- **Space Complexity:** $O(B \\cdot H \\cdot N^2)$ auxiliary memory for the attention matrix.`
};

export const DEMO_QUESTION_PAPER = `## 🎓 UNIVERSITY EXAMINATION MOCK PAPER
**Course:** Advanced Artificial Intelligence & Deep Learning
**Time Allowed:** 3 Hours | **Maximum Marks:** 60

---

### SECTION A: Objective & Conceptual Foundations (15 Marks)
*Answer all questions. Each carries 3 marks.*

1. State the role of the Softmax temperature parameter in attention distribution sharpening.
2. Distinguish between multi-head attention and grouped-query attention (GQA).
3. Why does standard backpropagation fail to scale efficiently in recurrent networks without gated units?
4. Define residual skip connections and write the mathematical formulation for a Pre-LN Transformer layer.
5. What is the Born interpretation of the quantum mechanical wave function?

---

### SECTION B: Analytical & Descriptive Derivations (25 Marks)
*Answer any 5 questions. Each carries 5 marks.*

6. Derive the scaled dot-product attention formulation and justify the scale factor $1/\\sqrt{d_k}$.
7. Explain the differences between natural radiation hazards (Radon-222) and anthropogenic isotopic contamination.
8. Detail the mathematical mechanism of backpropagation through time (BPTT) and how vanishing gradients occur.
9. Walk through the training dynamics of the AdamW optimizer with decoupled weight decay.
10. Outline the primary stages of an environmental disaster response framework.

---

### SECTION C: Applied Architecture & Case Study (20 Marks)
*Answer 1 comprehensive question carrying 20 marks.*

11. **System Architecture Design:**
    Design a production-grade Retrieval-Augmented Generation (RAG) platform to handle 100,000 university lecture slides.
    - Detail the document ingestion, chunking strategy, and vector indexing pipeline.
    - Explain how dense cosine similarity search minimizes hallucination.
    - Propose an evaluation metric to assess citation faithfulness and answer relevance.`;

