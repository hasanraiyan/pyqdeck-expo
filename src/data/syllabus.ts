import { Branch, SyllabusSemester } from '../types/syllabus';

/**
 * Stand-in data so the syllabus screens can be reviewed in Expo Go before any
 * backend exists. Shaped exactly like the API will return, so swapping this
 * for a fetch is a one-line change in each screen. Only CSE semester 5 is
 * filled in - that is enough to judge the UI.
 */

export const BRANCHES: Branch[] = [
  { id: 'cse', code: 'CSE', name: 'Computer Science & Engineering', subjectCount: 42 },
  { id: 'ece', code: 'ECE', name: 'Electronics & Communication', subjectCount: 38 },
  { id: 'ee', code: 'EE', name: 'Electrical Engineering', subjectCount: 36 },
  { id: 'me', code: 'ME', name: 'Mechanical Engineering', subjectCount: 40 },
  { id: 'ce', code: 'CE', name: 'Civil Engineering', subjectCount: 37 },
  { id: 'bme', code: 'BME', name: 'Biomedical Engineering', subjectCount: 31 },
];

const CSE_SEM5: SyllabusSemester = {
  number: 5,
  subjects: [
    {
      id: 'cse5-microprocessors',
      code: '100504',
      name: 'Microprocessors',
      credits: { l: 3, t: 0, p: 0, credits: 3 },
      kind: 'theory',
      pyqSubjectId: 'sem5_microprocessors',
      modules: [
        {
          id: 'm1',
          number: 1,
          title: 'Fundamentals of Microprocessors',
          topics: [
            { id: 't1', title: 'Evolution and classification of microprocessors' },
            { id: 't2', title: 'Bus organization and system architecture' },
            { id: 't3', title: 'Microprocessor vs microcontroller' },
          ],
        },
        {
          id: 'm2',
          number: 2,
          title: 'The 8051 Architecture',
          topics: [
            { id: 't4', title: 'Block diagram and functional units' },
            { id: 't5', title: 'Register set and special function registers' },
            { id: 't6', title: 'Internal RAM and ROM organization' },
            { id: 't7', title: 'Pin diagram and pin functions' },
            { id: 't8', title: 'Oscillator, clock and machine cycles' },
          ],
        },
        {
          id: 'm3',
          number: 3,
          title: 'Instruction Set and Programming',
          topics: [
            { id: 't9', title: 'Addressing modes' },
            { id: 't10', title: 'Data transfer and arithmetic instructions' },
            { id: 't11', title: 'Logical and branching instructions' },
            { id: 't12', title: 'Assembly language programming' },
          ],
        },
        {
          id: 'm4',
          number: 4,
          title: 'Memory and I/O Interfacing',
          topics: [
            { id: 't13', title: 'Memory address decoding' },
            { id: 't14', title: 'Interfacing external RAM and ROM' },
            { id: 't15', title: 'Programmable peripheral interface 8255' },
          ],
        },
        {
          id: 'm5',
          number: 5,
          title: 'External Communication Interface',
          topics: [
            { id: 't16', title: 'Serial communication and modes' },
            { id: 't17', title: 'Timers and counters' },
            { id: 't18', title: 'Interrupt structure and priority' },
          ],
        },
        {
          id: 'm6',
          number: 6,
          title: 'Applications',
          topics: [
            { id: 't19', title: 'Stepper motor and LED interfacing' },
            { id: 't20', title: 'ADC and DAC interfacing' },
          ],
        },
      ],
    },
    {
      id: 'cse5-dbms',
      code: '100503',
      name: 'Database Management System',
      credits: { l: 3, t: 1, p: 0, credits: 4 },
      kind: 'theory',
      pyqSubjectId: 'sem5_database_management_system',
      modules: [
        {
          id: 'm1',
          number: 1,
          title: 'Introduction to DBMS',
          topics: [
            { id: 't1', title: 'File system vs DBMS' },
            { id: 't2', title: 'Three-schema architecture and data independence' },
            { id: 't3', title: 'Data models and instances' },
          ],
        },
        {
          id: 'm2',
          number: 2,
          title: 'Relational Model and Algebra',
          topics: [
            { id: 't4', title: 'Keys, constraints and integrity rules' },
            { id: 't5', title: 'Relational algebra operations' },
            { id: 't6', title: 'Tuple and domain relational calculus' },
          ],
        },
        {
          id: 'm3',
          number: 3,
          title: 'SQL',
          topics: [
            { id: 't7', title: 'DDL, DML and DCL' },
            { id: 't8', title: 'Joins, nested queries and aggregation' },
            { id: 't9', title: 'Views, triggers and stored procedures' },
          ],
        },
        {
          id: 'm4',
          number: 4,
          title: 'Normalization',
          topics: [
            { id: 't10', title: 'Functional dependency and closure' },
            { id: 't11', title: '1NF, 2NF, 3NF and BCNF' },
            { id: 't12', title: 'Decomposition and lossless join' },
          ],
        },
        {
          id: 'm5',
          number: 5,
          title: 'Transactions and Concurrency',
          topics: [
            { id: 't13', title: 'ACID properties and schedules' },
            { id: 't14', title: 'Serializability' },
            { id: 't15', title: 'Locking protocols and deadlock' },
            { id: 't16', title: 'Recovery techniques' },
          ],
        },
      ],
    },
    {
      id: 'cse5-compiler',
      code: '100502',
      name: 'Compiler Design',
      credits: { l: 3, t: 0, p: 0, credits: 3 },
      kind: 'theory',
      pyqSubjectId: 'sem5_compiler_design',
      modules: [
        {
          id: 'm1',
          number: 1,
          title: 'Introduction to Compilers',
          topics: [
            { id: 't1', title: 'Phases of a compiler' },
            { id: 't2', title: 'Compiler construction tools' },
          ],
        },
        {
          id: 'm2',
          number: 2,
          title: 'Lexical Analysis',
          topics: [
            { id: 't3', title: 'Tokens, patterns and lexemes' },
            { id: 't4', title: 'Finite automata and regular expressions' },
          ],
        },
        {
          id: 'm3',
          number: 3,
          title: 'Syntax Analysis',
          topics: [
            { id: 't5', title: 'Context-free grammars' },
            { id: 't6', title: 'Top-down and bottom-up parsing' },
            { id: 't7', title: 'LR parsers' },
          ],
        },
        {
          id: 'm4',
          number: 4,
          title: 'Intermediate Code Generation',
          topics: [
            { id: 't8', title: 'Syntax-directed translation' },
            { id: 't9', title: 'Three-address code' },
          ],
        },
        {
          id: 'm5',
          number: 5,
          title: 'Code Optimization',
          topics: [
            { id: 't10', title: 'Basic blocks and flow graphs' },
            { id: 't11', title: 'Peephole optimization' },
          ],
        },
      ],
    },
    {
      id: 'cse5-micro-lab',
      code: '100514',
      name: 'Microprocessors Lab',
      credits: { l: 0, t: 0, p: 2, credits: 1 },
      kind: 'lab',
      modules: [
        {
          id: 'm1',
          number: 1,
          title: 'Experiments',
          topics: [
            { id: 't1', title: 'Addition and subtraction of two 8-bit numbers' },
            { id: 't2', title: 'Largest and smallest in an array' },
            { id: 't3', title: 'Sorting an array in ascending order' },
            { id: 't4', title: 'Binary to BCD conversion' },
            { id: 't5', title: 'LED blinking using port pins' },
            { id: 't6', title: 'Stepper motor interfacing' },
            { id: 't7', title: 'Serial data transmission' },
            { id: 't8', title: 'Timer-based square wave generation' },
          ],
        },
      ],
    },
    {
      id: 'cse5-dbms-lab',
      code: '100513',
      name: 'DBMS Lab',
      credits: { l: 0, t: 0, p: 2, credits: 1 },
      kind: 'lab',
      modules: [
        {
          id: 'm1',
          number: 1,
          title: 'Experiments',
          topics: [
            { id: 't1', title: 'DDL commands and table creation' },
            { id: 't2', title: 'DML commands and constraints' },
            { id: 't3', title: 'Nested queries and joins' },
            { id: 't4', title: 'Views and indexes' },
            { id: 't5', title: 'PL/SQL procedures and functions' },
            { id: 't6', title: 'Triggers and cursors' },
          ],
        },
      ],
    },
  ],
};

/** Semesters that have syllabus data. Others render as "not added yet". */
const BY_BRANCH: Record<string, SyllabusSemester[]> = {
  cse: [CSE_SEM5],
};

export const getSemester = (branchId: string, number: number): SyllabusSemester | null =>
  BY_BRANCH[branchId]?.find((s) => s.number === number) ?? null;

export const availableSemesters = (branchId: string): number[] =>
  (BY_BRANCH[branchId] ?? []).map((s) => s.number);
