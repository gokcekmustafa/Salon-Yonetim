import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, SearchX } from "lucide-react";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 animate-in">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-primary/8 flex items-center justify-center">
          <SearchX className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-foreground font-display">404</h1>
          <p className="text-lg text-muted-foreground font-medium">Sayfa bulunamadı</p>
          <p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
            Aradığınız sayfa mevcut değil veya taşınmış olabilir.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/">
            <Home className="h-4 w-4 mr-2" /> Ana Sayfaya Dön
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;