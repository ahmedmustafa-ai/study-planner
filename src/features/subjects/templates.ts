// Subject structure templates — unit/topic NAMES only (no lessons). Everything is editable after creation.
// AP unit names follow the College Board course frameworks; topic lists are condensed — edit freely.
import type { Level, SubjectKind } from '@/lib/types';

export interface SubjectTemplate {
  key: string;
  name: string;
  kind: SubjectKind;
  level: Level;
  languageLoad: boolean;
  units: { name: string; topics: string[] }[];
}

export const TEMPLATES: SubjectTemplate[] = [
  {
    key: 'ap-calc-ab',
    name: 'AP Calculus AB',
    kind: 'course',
    level: 'AP',
    languageLoad: false,
    units: [
      { name: 'Unit 1 · Limits and Continuity', topics: ['Limit notation & estimating limits', 'Algebraic limit techniques', 'Squeeze theorem', 'Types of discontinuities', 'Continuity', 'Limits at infinity & asymptotes', 'Intermediate Value Theorem'] },
      { name: 'Unit 2 · Differentiation: Definition and Fundamental Properties', topics: ['Average vs instantaneous rate of change', 'Definition of the derivative', 'Differentiability and continuity', 'Power, constant & sum rules', 'Derivatives of sin, cos, eˣ, ln x', 'Product & quotient rules'] },
      { name: 'Unit 3 · Differentiation: Composite, Implicit, and Inverse Functions', topics: ['Chain rule', 'Implicit differentiation', 'Derivatives of inverse functions', 'Inverse trig derivatives', 'Higher-order derivatives'] },
      { name: 'Unit 4 · Contextual Applications of Differentiation', topics: ['Derivatives in context', 'Straight-line motion', 'Related rates', 'Local linearity & linearization', "L'Hôpital's rule"] },
      { name: 'Unit 5 · Analytical Applications of Differentiation', topics: ['Mean Value Theorem', 'Extreme Value Theorem & critical points', 'Increasing / decreasing intervals', 'First derivative test', 'Candidates test (absolute extrema)', 'Concavity & second derivative test', 'Curve sketching', 'Optimization'] },
      { name: 'Unit 6 · Integration and Accumulation of Change', topics: ['Riemann sums', 'Definite integral notation', 'Fundamental Theorem of Calculus', 'Accumulation functions', 'Antiderivatives & indefinite integrals', 'u-substitution'] },
      { name: 'Unit 7 · Differential Equations', topics: ['Modeling with differential equations', 'Slope fields', 'Separation of variables', 'Exponential growth & decay'] },
      { name: 'Unit 8 · Applications of Integration', topics: ['Average value of a function', 'Motion using integrals', 'Accumulation in context', 'Area between curves', 'Volumes: cross sections', 'Volumes: disc & washer'] },
    ],
  },
  {
    key: 'ap-physics-1',
    name: 'AP Physics 1',
    kind: 'course',
    level: 'AP',
    languageLoad: true,
    units: [
      { name: 'Unit 1 · Kinematics', topics: ['Scalars & vectors', 'Displacement, velocity, acceleration', 'Motion graphs', 'Projectile motion'] },
      { name: 'Unit 2 · Force and Translational Dynamics', topics: ['Free-body diagrams', "Newton's laws", 'Friction', 'Circular motion', 'Gravitation'] },
      { name: 'Unit 3 · Work, Energy, and Power', topics: ['Work & kinetic energy', 'Potential energy', 'Conservation of energy', 'Power'] },
      { name: 'Unit 4 · Linear Momentum', topics: ['Impulse', 'Conservation of momentum', 'Elastic & inelastic collisions'] },
      { name: 'Unit 5 · Torque and Rotational Dynamics', topics: ['Rotational kinematics', 'Torque', 'Rotational inertia', 'Rotational equilibrium & dynamics'] },
      { name: 'Unit 6 · Energy and Momentum of Rotating Systems', topics: ['Rotational kinetic energy', 'Angular momentum', 'Rolling motion'] },
      { name: 'Unit 7 · Oscillations', topics: ['Simple harmonic motion', 'Springs & pendulums', 'Energy in SHM'] },
      { name: 'Unit 8 · Fluids', topics: ['Density & pressure', 'Buoyancy', "Fluid flow & Bernoulli's equation"] },
    ],
  },
  {
    key: 'sat',
    name: 'SAT',
    kind: 'test',
    level: 'none',
    languageLoad: true,
    units: [
      { name: 'R&W · Information and Ideas', topics: ['Central ideas & details', 'Command of evidence: textual', 'Command of evidence: quantitative', 'Inferences'] },
      { name: 'R&W · Craft and Structure', topics: ['Words in context', 'Text structure & purpose', 'Cross-text connections'] },
      { name: 'R&W · Expression of Ideas', topics: ['Rhetorical synthesis', 'Transitions'] },
      { name: 'R&W · Standard English Conventions', topics: ['Boundaries (punctuation)', 'Form, structure & sense'] },
      { name: 'Math · Algebra', topics: ['Linear equations in one variable', 'Linear functions', 'Linear equations in two variables', 'Systems of linear equations', 'Linear inequalities'] },
      { name: 'Math · Advanced Math', topics: ['Nonlinear functions', 'Nonlinear equations & systems', 'Equivalent expressions'] },
      { name: 'Math · Problem-Solving and Data Analysis', topics: ['Ratios, rates, proportions & units', 'Percentages', 'One-variable data', 'Two-variable data', 'Probability', 'Inference from samples', 'Evaluating statistical claims'] },
      { name: 'Math · Geometry and Trigonometry', topics: ['Area & volume', 'Lines, angles & triangles', 'Right triangles & trigonometry', 'Circles'] },
    ],
  },
  {
    key: 'chemistry',
    name: 'Chemistry',
    kind: 'course',
    level: 'regular',
    languageLoad: true,
    units: [
      { name: 'Matter & measurement', topics: ['Units & significant figures', 'Classification of matter'] },
      { name: 'Atomic structure', topics: ['Atomic models', 'Electron configuration'] },
      { name: 'Periodic table', topics: ['Organization of the table', 'Periodic trends'] },
      { name: 'Chemical bonding', topics: ['Ionic & covalent bonds', 'Lewis structures & molecular shape'] },
      { name: 'Chemical reactions', topics: ['Balancing equations', 'Reaction types'] },
      { name: 'Stoichiometry', topics: ['The mole', 'Stoichiometry calculations', 'Limiting reactant'] },
      { name: 'Gases', topics: ['Gas laws'] },
      { name: 'Solutions', topics: ['Concentration & molarity'] },
      { name: 'Acids & bases', topics: ['pH & acid–base theories'] },
      { name: 'Thermochemistry', topics: ['Energy changes in reactions'] },
    ],
  },
  {
    key: 'biology',
    name: 'Biology',
    kind: 'course',
    level: 'regular',
    languageLoad: true,
    units: [
      { name: 'Chemistry of life', topics: ['Water & macromolecules', 'Enzymes'] },
      { name: 'Cells', topics: ['Cell structure', 'Membranes & transport'] },
      { name: 'Energy in cells', topics: ['Photosynthesis', 'Cellular respiration'] },
      { name: 'Cell division', topics: ['Mitosis', 'Meiosis'] },
      { name: 'Genetics', topics: ['Mendelian inheritance', 'DNA structure & replication', 'Protein synthesis'] },
      { name: 'Evolution', topics: ['Natural selection', 'Evidence for evolution'] },
      { name: 'Ecology', topics: ['Ecosystems & energy flow', 'Populations'] },
    ],
  },
  {
    key: 'physics',
    name: 'Physics',
    kind: 'course',
    level: 'regular',
    languageLoad: true,
    units: [
      { name: 'Motion', topics: ['Kinematics', 'Graphs of motion'] },
      { name: 'Forces', topics: ["Newton's laws", 'Friction'] },
      { name: 'Energy', topics: ['Work & energy', 'Power'] },
      { name: 'Momentum', topics: ['Momentum & collisions'] },
      { name: 'Waves', topics: ['Wave properties', 'Sound', 'Light'] },
      { name: 'Electricity & magnetism', topics: ['Circuits', "Ohm's law", 'Magnetism'] },
    ],
  },
  {
    key: 'env-science',
    name: 'Environmental Science',
    kind: 'course',
    level: 'regular',
    languageLoad: true,
    units: [
      { name: 'Ecosystems', topics: ['Energy flow', 'Biogeochemical cycles'] },
      { name: 'Populations', topics: ['Population growth', 'Human population'] },
      { name: 'Resources', topics: ['Water', 'Land & soil', 'Energy resources'] },
      { name: 'Pollution & climate', topics: ['Air & water pollution', 'Climate change'] },
    ],
  },
  {
    key: 'english-growth',
    name: 'English B1 → C1',
    kind: 'skill',
    level: 'none',
    languageLoad: true,
    units: [
      { name: 'Reading', topics: ['Academic reading volume', 'Main idea & inference'] },
      { name: 'Vocabulary', topics: ['Academic word list', 'Science terminology'] },
      { name: 'Writing', topics: ['Grammar & sentence structure', 'Paragraph & essay organization'] },
      { name: 'Listening & speaking', topics: ['Academic listening', 'Speaking fluency'] },
    ],
  },
  {
    key: 'blank',
    name: 'New subject',
    kind: 'course',
    level: 'regular',
    languageLoad: false,
    units: [{ name: 'Unit 1', topics: [] }],
  },
];
