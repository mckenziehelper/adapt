import { database, ProgramModel } from './watermelon'

export async function saveProgram(programData: any, coachNote: string): Promise<ProgramModel> {
  return await database.write(async () => {
    // Deactivate current active programs
    const activePrograms = await database.get<ProgramModel>('programs').query().fetch()
    for (const p of activePrograms) {
      if (p.isActive) {
        await p.update((record) => {
          record.isActive = false
        })
      }
    }

    // Create new program
    const program = await database.get<ProgramModel>('programs').create((record) => {
      record.isActive = true
      record.programJson = JSON.stringify(programData)
      record.coachNote = coachNote
      record.version = 1
    })

    return program
  })
}

export async function getActiveProgram(): Promise<ProgramModel | null> {
  const programs = await database.get<ProgramModel>('programs').query().fetch()
  return programs.find((p) => p.isActive) ?? null
}
