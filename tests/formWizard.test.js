import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { WIZARD_FORM_TEMPLATE, draftFromTemplate, normalizeFields, normalizeFormSettings, isCreatableFormKind, isFixedFormKind, submissionTitle } from '../src/lib/opsForms.js'
import { isWizardForm, wizardSteps, wizardScreens, validateStep, firstInvalidStep, answerRows } from '../src/lib/formWizard.js'
import { canSubmitOpsFormKind } from '../src/auth/permissions.js'

describe('wizard forms', () => {
  it('creates isolated custom drafts with live branches', () => {
    const original = JSON.stringify(WIZARD_FORM_TEMPLATE)
    const draft = draftFromTemplate(WIZARD_FORM_TEMPLATE, { branchSlugs: ['bacoor'] })
    assert.equal(draft.kind, 'custom')
    assert.equal(draft.status, 'draft')
    assert.equal(draft.id, null)
    assert.equal(draft.slug, '')
    assert.deepEqual(draft.fields.find(f => f.key === 'branch').options, ['bacoor'])
    assert.ok(['customer_name', 'phone', 'branch'].every(k => draft.fields.some(f => f.key === k)))
    assert.ok(draft.fields.every(f => draft.settings.steps.some(s => s.id === f.step)))
    draft.fields[0].label = 'Changed'
    draft.settings.steps[0].title = 'Changed'
    draft.settings.thank_you.body = 'Changed'
    assert.equal(JSON.stringify(WIZARD_FORM_TEMPLATE), original)
  })
  it('keeps optional field steps and drops unknown keys', () => {
    const [a,b] = normalizeFields([{ label: 'A', step: ' about ', extra: true }, { label: 'B', step: ' ' }])
    assert.equal(a.step, 'about')
    assert.equal('extra' in a, false)
    assert.equal('step' in b, false)
  })
  it('normalizes settings without losing legacy settings', () => {
    const old = { show_on_calendar: true, push_to_planning: false, show_logo: false, header_title: 'Inquiry', slug_locked: true }
    const normalized = normalizeFormSettings(old, 'detailing')
    for (const [key,value] of Object.entries(old)) assert.equal(normalized[key], value)
    assert.equal(normalized.layout, 'page')
    assert.equal(normalized.review, false)
    const wizard = normalizeFormSettings({ layout: 'wizard', steps: [{}, { id: 'step_1', title: 'Car' }, { id: '__review' }, null] })
    assert.equal(new Set(wizard.steps.map(s => s.id)).size, 4)
    assert.ok(wizard.steps.every(s => s.id !== '__review'))
    assert.equal(wizard.steps[0].title, 'Step 1')
    assert.equal(wizard.review, true)
  })
  it('groups missing and unknown assignments into the first step, keeping empty steps', () => {
    const form = { settings: { layout: 'wizard', steps: [{id:'a'}, {id:'b'}, {id:'c'}] }, fields: [{label:'A'}, {label:'B',step:'unknown'}, {label:'C',step:'b'}] }
    assert.equal(isWizardForm(form), true)
    assert.deepEqual(wizardSteps(form).map(s => s.fields.length), [2,1,0])
    assert.equal(wizardScreens(form).length, 4)
    assert.equal(wizardScreens({...form, settings:{...form.settings, review:false}}).length, 3)
    assert.equal(isWizardForm({}), false)
    assert.equal(isWizardForm({settings:{layout:'wizard',steps:[]}}), false)
  })
  it('validates only current step and finds the first invalid step', () => {
    const steps = wizardSteps(draftFromTemplate(WIZARD_FORM_TEMPLATE))
    assert.deepEqual(validateStep(steps[0], {}), ['Full name is required','Mobile number is required'])
    assert.equal(firstInvalidStep(steps, {}), 0)
    const values = {customer_name:'Ana',phone:'09123456789',plate:'ABC123',branch:'bacoor',request_type:'Option A'}
    assert.equal(firstInvalidStep(steps, values), -1)
    assert.equal(firstInvalidStep(steps, {...values, plate:''}), 1)
    assert.deepEqual(validateStep(steps[0], {...values,email:'bad'}), ['Email must be a valid email'])
  })
  it('formats review answers, keeping zero and skipping empty/unchecked values', () => {
    const step = { fields: normalizeFields([{key:'date',label:'Date',type:'date'},{key:'yes',label:'Yes',type:'checkbox'},{key:'no',label:'No',type:'checkbox'},{key:'zero',label:'Zero',type:'number'},{key:'blank',label:'Blank'}]) }
    const rows = answerRows(step,{date:'2026-10-24',yes:true,no:false,zero:0,blank:' '})
    assert.deepEqual(rows.map(r => r.value), ['Sat, 24 Oct 2026','Yes','0'])
  })
  it('gives custom the detailing creation, permission, and title behavior', () => {
    assert.equal(isFixedFormKind('custom'),false)
    for (const kind of ['detailing','custom']) assert.equal(isCreatableFormKind(kind),true)
    assert.equal(isCreatableFormKind('complaint'),false)
    for (const role of [null,'staff','detailer','BossMich','assistant_super_admin','admin','operations_lead','team_lead','marketing','video_editor']) {
      assert.equal(canSubmitOpsFormKind({role},'custom'),canSubmitOpsFormKind({role},'detailing'))
    }
    assert.equal(canSubmitOpsFormKind(null,'custom'),false)
    assert.equal(submissionTitle({kind:'custom',name:'Quote request'},{customer_name:'Ana'}),'Quote request: Ana')
  })
})
