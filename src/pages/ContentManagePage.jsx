import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ContentManagePage() {
  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Marketing Content</p>
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Posts and Events</h1>
      </header>
      <Tabs defaultValue="posts">
        <TabsList aria-label="Content type">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>
        <TabsContent value="posts" className="pt-4">
          <p className="text-sm text-muted-foreground">Manage public Latest Post content.</p>
        </TabsContent>
        <TabsContent value="events" className="pt-4">
          <p className="text-sm text-muted-foreground">Manage public Events and Meets content.</p>
        </TabsContent>
      </Tabs>
    </main>
  )
}
