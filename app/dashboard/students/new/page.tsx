import StudentForm from '@/components/forms/StudentForm'

export default function NewStudentPage() {
  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Admission</h1>
        <p className="text-sm text-gray-500 mt-1">Fill in all details to register a new student</p>
      </div>
      <StudentForm />
    </div>
  )
}
