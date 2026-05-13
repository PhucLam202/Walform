import type { FormConfig } from '@/types/form';

type TemplateConfig = Omit<FormConfig, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

export interface TemplateCategory {
  label: string;
  icon: string;
  keys: string[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    label: 'Hackathon',
    icon: '🏆',
    keys: ['hackathon_registration', 'project_submission', 'team_formation', 'mentor_request', 'sponsor_feedback'],
  },
  {
    label: 'General',
    icon: '📋',
    keys: ['bug_report', 'feature_request', 'office_hours', 'survey', 'job_application'],
  },
];

export const TEMPLATE_META: Record<string, { label: string; description: string }> = {
  hackathon_registration: { label: 'Hackathon Registration', description: 'Participant sign-up form' },
  project_submission:     { label: 'Project Submission',     description: 'Submit your hackathon project' },
  team_formation:         { label: 'Team Formation',         description: 'Find teammates or join a team' },
  mentor_request:         { label: 'Mentor Request',         description: 'Request a mentoring session' },
  sponsor_feedback:       { label: 'Sponsor Feedback',       description: 'Collect sponsor impressions' },
  bug_report:             { label: 'Bug Report',             description: 'Report issues you encounter' },
  feature_request:        { label: 'Feature Request',        description: 'Share ideas for new features' },
  office_hours:           { label: 'Office Hours Sign-Up',   description: 'Book a slot with the team' },
  survey:                 { label: 'General Survey',         description: 'Collect general feedback' },
  job_application:        { label: 'Job Application',        description: 'Encrypted end-to-end hiring form' },
};

export const TEMPLATES: Record<string, TemplateConfig> = {
  /* ──────────────────── HACKATHON ──────────────────── */

  hackathon_registration: {
    title: 'Hackathon Registration',
    description: 'Register to participate in our hackathon. Personal details are encrypted end-to-end.',
    form_type: 'hackathon_registration',
    sensitiveFieldIds: ['reg_email', 'reg_phone', 'reg_wallet'],
    fields: [
      { id: 'reg_name',       type: 'text',     label: 'Full Name',            placeholder: 'Your full name',              isSensitive: false, validation: { required: true  }, order: 0 },
      { id: 'reg_email',      type: 'email',    label: 'Email Address',        placeholder: 'you@example.com',             isSensitive: true,  validation: { required: true  }, order: 1 },
      { id: 'reg_phone',      type: 'phone',    label: 'Phone Number',         placeholder: '+1 (555) 000-0000',           isSensitive: true,  validation: { required: false }, order: 2 },
      { id: 'reg_github',     type: 'github',   label: 'GitHub Profile',       placeholder: 'https://github.com/username', isSensitive: false, validation: { required: false }, order: 3 },
      { id: 'reg_wallet',     type: 'wallet',   label: 'Sui Wallet Address',   placeholder: '0x…',                         isSensitive: true,  validation: { required: false }, order: 4 },
      { id: 'reg_role',       type: 'checkbox', label: 'Your Role(s)',         isSensitive: false, options: ['Frontend Dev', 'Backend Dev', 'Smart Contract Dev', 'Designer', 'Product Manager', 'Data / AI', 'Other'], validation: { required: true }, order: 5 },
      { id: 'reg_experience', type: 'dropdown', label: 'Web3 Experience',      isSensitive: false, options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'], validation: { required: true }, order: 6 },
      { id: 'reg_team',       type: 'radio',    label: 'Do you have a team?',  isSensitive: false, options: ['Yes, full team', 'Partial team', 'Looking for teammates', 'Solo'], validation: { required: true }, order: 7 },
      { id: 'reg_tshirt',     type: 'dropdown', label: 'T-shirt Size',         isSensitive: false, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], validation: { required: false }, order: 8 },
      { id: 'reg_dietary',    type: 'text',     label: 'Dietary Restrictions', placeholder: 'Vegetarian, vegan, allergies…', isSensitive: false, validation: { required: false }, order: 9 },
    ],
  },

  project_submission: {
    title: 'Project Submission',
    description: 'Submit your hackathon project for judging. All fields are public except wallet address.',
    form_type: 'project_submission',
    sensitiveFieldIds: ['sub_wallet'],
    fields: [
      { id: 'sub_project_name', type: 'text',     label: 'Project Name',          placeholder: 'Your awesome project',             isSensitive: false, validation: { required: true  }, order: 0 },
      { id: 'sub_tagline',      type: 'text',     label: 'One-Line Tagline',       placeholder: 'Describe your project in one sentence', isSensitive: false, validation: { required: true, maxLength: 120 }, order: 1 },
      { id: 'sub_track',        type: 'dropdown', label: 'Hackathon Track',        isSensitive: false, options: ['DeFi', 'NFT / Gaming', 'Infrastructure', 'Social / DAO', 'AI + Web3', 'Open Track'], validation: { required: true }, order: 2 },
      { id: 'sub_description',  type: 'textarea', label: 'Project Description',   placeholder: 'What does it do and why does it matter?', isSensitive: false, validation: { required: true }, order: 3 },
      { id: 'sub_tech_stack',   type: 'textarea', label: 'Tech Stack',            placeholder: 'Sui Move, Next.js, Walrus, Seal…',  isSensitive: false, validation: { required: true }, order: 4 },
      { id: 'sub_repo',         type: 'github',   label: 'GitHub Repository',     placeholder: 'https://github.com/team/project',  isSensitive: false, validation: { required: true  }, order: 5 },
      { id: 'sub_demo',         type: 'url',      label: 'Live Demo URL',         placeholder: 'https://your-project.vercel.app',  isSensitive: false, validation: { required: false }, order: 6 },
      { id: 'sub_video',        type: 'url',      label: 'Demo Video URL',        placeholder: 'https://youtube.com/watch?v=…',    isSensitive: false, validation: { required: false }, order: 7 },
      { id: 'sub_deck',         type: 'file',     label: 'Pitch Deck (PDF)',      isSensitive: false, validation: { required: false, allowedFileTypes: ['application/pdf'], maxFileSizeMB: 20 }, order: 8 },
      { id: 'sub_wallet',       type: 'wallet',   label: 'Prize Wallet Address',  placeholder: '0x…',                              isSensitive: true,  validation: { required: false }, order: 9 },
      { id: 'sub_team_members', type: 'textarea', label: 'Team Members',          placeholder: 'Name – Role, Name – Role…',        isSensitive: false, validation: { required: false }, order: 10 },
    ],
  },

  team_formation: {
    title: 'Team Formation',
    description: 'Find teammates or let others know you\'re looking to join a team.',
    form_type: 'team_formation',
    sensitiveFieldIds: ['tf_email', 'tf_discord'],
    fields: [
      { id: 'tf_name',       type: 'text',     label: 'Your Name',            placeholder: 'Full name or handle',          isSensitive: false, validation: { required: true  }, order: 0 },
      { id: 'tf_email',      type: 'email',    label: 'Contact Email',        placeholder: 'you@example.com',             isSensitive: true,  validation: { required: true  }, order: 1 },
      { id: 'tf_discord',    type: 'text',     label: 'Discord Handle',       placeholder: 'username#1234 or @username',  isSensitive: true,  validation: { required: false }, order: 2 },
      { id: 'tf_github',     type: 'github',   label: 'GitHub Profile',       placeholder: 'https://github.com/username', isSensitive: false, validation: { required: false }, order: 3 },
      { id: 'tf_status',     type: 'radio',    label: 'I am…',                isSensitive: false, options: ['Looking for teammates', 'Looking to join a team', 'Have an idea, need a team', 'Both'], validation: { required: true }, order: 4 },
      { id: 'tf_roles',      type: 'checkbox', label: 'Skills I bring',       isSensitive: false, options: ['Frontend Dev', 'Backend Dev', 'Smart Contract Dev', 'Designer', 'Product Manager', 'Data / AI', 'Marketing', 'Other'], validation: { required: true }, order: 5 },
      { id: 'tf_roles_need', type: 'checkbox', label: 'Roles I need',         isSensitive: false, options: ['Frontend Dev', 'Backend Dev', 'Smart Contract Dev', 'Designer', 'Product Manager', 'Data / AI', 'Marketing', 'Other'], validation: { required: false }, order: 6 },
      { id: 'tf_idea',       type: 'textarea', label: 'Project Idea (optional)', placeholder: 'What do you want to build?', isSensitive: false, validation: { required: false }, order: 7 },
      { id: 'tf_experience', type: 'rating',   label: 'Web3 Experience (1–5)', isSensitive: false, validation: { required: true }, order: 8 },
    ],
  },

  mentor_request: {
    title: 'Mentor Request',
    description: 'Request a mentoring session during the hackathon.',
    form_type: 'mentor_request',
    sensitiveFieldIds: ['mr_email'],
    fields: [
      { id: 'mr_name',        type: 'text',     label: 'Your Name',              placeholder: 'Full name',                    isSensitive: false, validation: { required: true  }, order: 0 },
      { id: 'mr_team',        type: 'text',     label: 'Team / Project Name',    placeholder: 'What are you building?',       isSensitive: false, validation: { required: true  }, order: 1 },
      { id: 'mr_email',       type: 'email',    label: 'Contact Email',          placeholder: 'you@example.com',             isSensitive: true,  validation: { required: true  }, order: 2 },
      { id: 'mr_area',        type: 'checkbox', label: 'Help needed in',         isSensitive: false, options: ['Smart Contract / Move', 'Frontend Integration', 'Tokenomics / DeFi', 'Product / UX', 'Pitching', 'Business Model', 'Other'], validation: { required: true }, order: 3 },
      { id: 'mr_question',    type: 'textarea', label: 'Specific Questions',     placeholder: 'What would you like guidance on?', isSensitive: false, validation: { required: true }, order: 4 },
      { id: 'mr_demo',        type: 'url',      label: 'Project URL / Demo',     placeholder: 'https://…',                   isSensitive: false, validation: { required: false }, order: 5 },
      { id: 'mr_slot_pref',   type: 'dropdown', label: 'Preferred Time Slot',    isSensitive: false, options: ['Morning (9am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–8pm)', 'No preference'], validation: { required: false }, order: 6 },
      { id: 'mr_duration',    type: 'radio',    label: 'Session Length',         isSensitive: false, options: ['15 minutes', '30 minutes', '45 minutes'], validation: { required: true }, order: 7 },
    ],
  },

  sponsor_feedback: {
    title: 'Sponsor Feedback',
    description: 'Help us understand what sponsors thought of the event and projects.',
    form_type: 'sponsor_feedback',
    sensitiveFieldIds: ['sf_email', 'sf_company'],
    fields: [
      { id: 'sf_name',         type: 'text',     label: 'Your Name',                    placeholder: 'Full name',             isSensitive: false, validation: { required: true  }, order: 0 },
      { id: 'sf_company',      type: 'text',     label: 'Company / Organisation',       placeholder: 'Company name',          isSensitive: true,  validation: { required: true  }, order: 1 },
      { id: 'sf_email',        type: 'email',    label: 'Business Email',               placeholder: 'you@company.com',       isSensitive: true,  validation: { required: true  }, order: 2 },
      { id: 'sf_overall',      type: 'rating',   label: 'Overall Event Rating (1–5)',   isSensitive: false, validation: { required: true  }, order: 3 },
      { id: 'sf_project_qual', type: 'rating',   label: 'Project Quality (1–5)',        isSensitive: false, validation: { required: true  }, order: 4 },
      { id: 'sf_organisation', type: 'rating',   label: 'Organisation & Logistics (1–5)', isSensitive: false, validation: { required: true }, order: 5 },
      { id: 'sf_highlight',    type: 'textarea', label: 'Highlight of the Event',       placeholder: 'What stood out most?',  isSensitive: false, validation: { required: false }, order: 6 },
      { id: 'sf_improve',      type: 'textarea', label: 'Suggestions for Improvement', placeholder: 'How can we do better?', isSensitive: false, validation: { required: false }, order: 7 },
      { id: 'sf_sponsor_again',type: 'radio',    label: 'Would you sponsor again?',     isSensitive: false, options: ['Definitely', 'Likely', 'Unsure', 'No'], validation: { required: true }, order: 8 },
      { id: 'sf_prize_tracks', type: 'checkbox', label: 'Tracks of interest next time', isSensitive: false, options: ['DeFi', 'NFT / Gaming', 'Infrastructure', 'Social / DAO', 'AI + Web3', 'Open Track'], validation: { required: false }, order: 9 },
    ],
  },

  /* ──────────────────── GENERAL ──────────────────── */
  bug_report: {
    title: 'Bug Report',
    description: 'Help us improve by reporting issues you encounter.',
    form_type: 'bug_report',
    sensitiveFieldIds: ['contact_email'],
    fields: [
      { id: 'bug_title', type: 'text', label: 'Bug Title', placeholder: 'Short summary of the issue', isSensitive: false, validation: { required: true }, order: 0 },
      { id: 'severity', type: 'dropdown', label: 'Severity', isSensitive: false, options: ['Critical', 'High', 'Medium', 'Low'], validation: { required: true }, order: 1 },
      { id: 'steps', type: 'textarea', label: 'Steps to Reproduce', placeholder: '1. Go to...\n2. Click on...', isSensitive: false, validation: { required: true }, order: 2 },
      { id: 'screenshot', type: 'file', label: 'Screenshot / Video', isSensitive: false, validation: { required: false, allowedFileTypes: ['image/*', 'video/*'], maxFileSizeMB: 20 }, order: 3 },
      { id: 'contact_email', type: 'email', label: 'Contact Email', placeholder: 'your@email.com', isSensitive: true, validation: { required: false }, order: 4 },
    ],
  },

  feature_request: {
    title: 'Feature Request',
    description: 'Share your ideas to help us build what you need.',
    form_type: 'feature_request',
    sensitiveFieldIds: ['requester_email'],
    fields: [
      { id: 'feature_name', type: 'text', label: 'Feature Name', placeholder: 'What should it be called?', isSensitive: false, validation: { required: true }, order: 0 },
      { id: 'problem', type: 'textarea', label: 'Problem Statement', placeholder: 'What problem does this solve?', isSensitive: false, validation: { required: true }, order: 1 },
      { id: 'solution', type: 'textarea', label: 'Proposed Solution', placeholder: 'Describe your idea', isSensitive: false, validation: { required: false }, order: 2 },
      { id: 'priority', type: 'rating', label: 'Priority (1–5)', isSensitive: false, validation: { required: true }, order: 3 },
      { id: 'requester_email', type: 'email', label: 'Your Email', placeholder: 'your@email.com', isSensitive: true, validation: { required: false }, order: 4 },
    ],
  },

  office_hours: {
    title: 'Office Hours Sign-Up',
    description: 'Book a slot and tell us about your project.',
    form_type: 'office_hours',
    sensitiveFieldIds: [],
    fields: [
      { id: 'name', type: 'text', label: 'Your Name', placeholder: 'Full name', isSensitive: false, validation: { required: true }, order: 0 },
      { id: 'what_built', type: 'textarea', label: 'What Are You Building?', placeholder: 'Briefly describe your project', isSensitive: false, validation: { required: true }, order: 1 },
      { id: 'experience', type: 'rating', label: 'Experience Level (1–5)', isSensitive: false, validation: { required: true }, order: 2 },
      { id: 'feedback', type: 'textarea', label: 'What feedback do you need?', placeholder: 'Specific questions or areas', isSensitive: false, validation: { required: false }, order: 3 },
      { id: 'project_url', type: 'url', label: 'Project URL', placeholder: 'https://github.com/...', isSensitive: false, validation: { required: false }, order: 4 },
    ],
  },

  survey: {
    title: 'General Survey',
    description: 'Share your thoughts and help us improve.',
    form_type: 'survey',
    sensitiveFieldIds: [],
    fields: [
      { id: 'topic', type: 'text', label: 'Survey Topic', placeholder: 'What is this survey about?', isSensitive: false, validation: { required: true }, order: 0 },
      { id: 'satisfaction', type: 'rating', label: 'Overall Satisfaction (1–5)', isSensitive: false, validation: { required: true }, order: 1 },
      { id: 'liked', type: 'textarea', label: 'What did you like?', placeholder: 'Tell us what worked well', isSensitive: false, validation: { required: false }, order: 2 },
      { id: 'improved', type: 'textarea', label: 'What could be improved?', placeholder: 'Constructive feedback', isSensitive: false, validation: { required: false }, order: 3 },
      { id: 'recommend', type: 'radio', label: 'Would you recommend us?', isSensitive: false, options: ['Definitely', 'Probably', 'Not Sure', 'No'], validation: { required: true }, order: 4 },
    ],
  },

  job_application: {
    title: 'Job Application',
    description: 'Apply for an open position. Your resume is encrypted end-to-end.',
    form_type: 'job_application',
    sensitiveFieldIds: ['applicant_name', 'resume'],
    fields: [
      { id: 'applicant_name', type: 'text', label: 'Full Name', placeholder: 'Your legal name', isSensitive: true, validation: { required: true }, order: 0 },
      { id: 'position', type: 'dropdown', label: 'Position', isSensitive: false, options: ['Engineer', 'Designer', 'Product Manager', 'Marketing', 'Other'], validation: { required: true }, order: 1 },
      { id: 'resume', type: 'file', label: 'Resume / CV', isSensitive: true, validation: { required: true, allowedFileTypes: ['application/pdf', '.doc', '.docx'], maxFileSizeMB: 10 }, order: 2 },
      { id: 'cover_letter', type: 'textarea', label: 'Cover Letter', placeholder: 'Why are you a great fit?', isSensitive: false, validation: { required: false }, order: 3 },
      { id: 'portfolio', type: 'url', label: 'Portfolio / GitHub URL', placeholder: 'https://', isSensitive: false, validation: { required: false }, order: 4 },
    ],
  },
};
