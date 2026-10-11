import {describe,it,expect} from 'vitest';
import {adminCommandSchema,adminQuerySchema} from '../../src/shared/admin';
import {createBookingSchema} from '../../src/shared/validation';
describe('admin request boundaries',()=>{
 it('allows explicit bounded demo settings and rejects participant time or cost overrides',()=>{
  const command={action:'configure_demo',enabled:true,durationMinutes:1,costUnits:30,version:1,reason:'Live credit transfer demonstration'};
  expect(adminCommandSchema.safeParse(command).success).toBe(true);
  for(const patch of [{durationMinutes:0},{durationMinutes:11},{durationMinutes:1.5},{costUnits:0},{costUnits:31},{costUnits:181},{version:0},{enabled:'true'},{target:'00000000-0000-4000-8000-000000000001'}])expect(adminCommandSchema.safeParse({...command,...patch}).success).toBe(false);
  const request={teacherId:'00000000-0000-4000-8000-000000000001',skillId:'00000000-0000-4000-8000-000000000002',startMode:'demo',policyVersion:1};
  expect(createBookingSchema.safeParse(request).success).toBe(true);
  for(const patch of [{policyVersion:0},{costUnits:30},{durationMinutes:1},{startsAt:'2026-10-11T12:00:00Z'},{endsAt:'2026-10-11T12:00:00Z'}])expect(createBookingSchema.safeParse({...request,...patch}).success).toBe(false);
 });
 it('requires a valid target and meaningful reason without client authority fields',()=>{
  const action={action:'suspend_member',target:'00000000-0000-4000-8000-000000000001',reason:'Account moderation reason'};
  expect(adminCommandSchema.safeParse(action).success).toBe(true);
  for(const change of [{reason:'short'},{target:'someone'},{actor:action.target},{role:'admin'},{credits:100}])expect(adminCommandSchema.safeParse({...action,...change}).success).toBe(false);
 });
 it('bounds catalogue input and administrative pagination',()=>{
  expect(adminCommandSchema.safeParse({action:'create_skill',slug:'new-skill',name:'New skill',category:'Demo',reason:'Catalogue addition reason'}).success).toBe(true);
  expect(adminCommandSchema.safeParse({action:'create_skill',slug:'../path',name:'New skill',category:'Demo',reason:'Catalogue addition reason'}).success).toBe(false);
  for(const q of [{page:-1},{page:4001},{section:'secrets'},{search:'x'.repeat(101)}])expect(adminQuerySchema.safeParse(q).success).toBe(false);
 });
});
