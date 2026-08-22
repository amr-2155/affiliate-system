import RegisterForm from "./RegisterForm"

interface RegisterPageProps {
  searchParams: Promise<{ ref?: string }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams
  return <RegisterForm refCode={params.ref || ""} />
}
