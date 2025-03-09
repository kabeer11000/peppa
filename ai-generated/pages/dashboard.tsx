import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import firebase, { auth, db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { PlusCircle, Trash2 } from "lucide-react"
import Head from "next/head"

type Environment = {
  id: string
  name: string
  os: string
  aiModel: string
  task: string
  createdAt: any
}

export default function DashboardPage() {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)
  const [newEnvName, setNewEnvName] = useState("")
  const [newEnvOS, setNewEnvOS] = useState("linux")
  const [newEnvAIModel, setNewEnvAIModel] = useState("deepseek")
  const [newEnvTask, setNewEnvTask] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/auth')
      } else {
        fetchEnvironments()
      }
    })

    return () => unsubscribe()
  }, [router])

  const fetchEnvironments = async () => {
    try {
      const user = auth.currentUser
      if (!user) return

      const snapshot = await db.collection("environments")
        .where("userId", "==", user.uid)
        .get()
      
      const envs: Environment[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        envs.push({
          id: doc.id,
          name: data.name,
          os: data.os,
          aiModel: data.aiModel,
          task: data.task,
          createdAt: data.createdAt
        })
      })
      
      setEnvironments(envs.sort((a, b) => b.createdAt - a.createdAt))
      setLoading(false)
    } catch (error) {
      console.error("Error fetching environments:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load environments.",
      })
      setLoading(false)
    }
  }

  const createEnvironment = async () => {
    try {
      const user = auth.currentUser
      if (!user) return

      if (!newEnvName.trim()) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please provide a name for the environment.",
        })
        return
      }

      const newEnv = {
        name: newEnvName,
        os: newEnvOS,
        aiModel: newEnvAIModel,
        task: newEnvTask,
        userId: user.uid,
        createdAt: new Date()
      }

      const docRef = await db.collection("environments").add(newEnv)
      
      setEnvironments([
        {
          id: docRef.id,
          name: newEnvName,
          os: newEnvOS,
          aiModel: newEnvAIModel,
          task: newEnvTask,
          createdAt: new Date()
        },
        ...environments
      ])
      
      setNewEnvName("")
      setNewEnvTask("")
      setDialogOpen(false)
      
      toast({
        title: "Environment created",
        description: "Your new environment has been created successfully.",
      })
    } catch (error) {
      console.error("Error creating environment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create environment.",
      })
    }
  }

  const deleteEnvironment = async (id: string) => {
    try {
      await db.collection("environments").doc(id).delete()
      setEnvironments(environments.filter(env => env.id !== id))
      
      toast({
        title: "Environment deleted",
        description: "The environment has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting environment:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete environment.",
      })
    }
  }

  const openEnvironment = (id: string) => {
    router.push(`/environment/${id}`)
  }

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      router.push('/')
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <>
      <Head>
        <title>Dashboard - Peppa</title>
        <meta name="description" content="Manage your AI environments" />
      </Head>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-between">
            <div className="flex">
              <a href="/" className="flex items-center space-x-2">
                <span className="font-bold text-xl inline-block">🐷 Peppa</span>
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
            </div>
          </div>
        </header>
        <main className="flex-1 container py-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Your Environments</h1>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Environment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Environment</DialogTitle>
                  <DialogDescription>
                    Configure a new environment for AI agents to operate in.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={newEnvName}
                      onChange={(e) => setNewEnvName(e.target.value)}
                      className="col-span-3"
                      placeholder="My Environment"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="os" className="text-right">
                      Operating System
                    </Label>
                    <Select value={newEnvOS} onValueChange={setNewEnvOS}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select OS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linux">Linux</SelectItem>
                        <SelectItem value="windows">Windows</SelectItem>
                        <SelectItem value="freedos">FreeDOS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ai-model" className="text-right">
                      AI Model
                    </Label>
                    <Select value={newEnvAIModel} onValueChange={setNewEnvAIModel}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select AI Model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deepseek">DeepSeek</SelectItem>
                        <SelectItem value="gemini">Gemini</SelectItem>
                        <SelectItem value="claude">Claude</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="task" className="text-right">
                      Task
                    </Label>
                    <Input
                      id="task"
                      value={newEnvTask}
                      onChange={(e) => setNewEnvTask(e.target.value)}
                      className="col-span-3"
                      placeholder="Open Google in a browser"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createEnvironment}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <p>Loading environments...</p>
            </div>
          ) : environments.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 space-y-4">
              <p className="text-muted-foreground">You don't have any environments yet.</p>
              <Button onClick={() => setDialogOpen(true)}>Create Your First Environment</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {environments.map((env) => (
                <Card key={env.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle>{env.name}</CardTitle>
                    <CardDescription>
                      {env.os.charAt(0).toUpperCase() + env.os.slice(1)} • {env.aiModel.charAt(0).toUpperCase() + env.aiModel.slice(1)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {env.task || "No task specified"}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => openEnvironment(env.id)}>
                      Open
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteEnvironment(env.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
} 