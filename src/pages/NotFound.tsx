import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-lg text-muted-foreground">Sayfa bulunamadı</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Aradığınız sayfa mevcut değil veya taşınmış olabilir.
        </p>
        <Button asChild>
          <Link to="/">
            <Home className="h-4 w-4 mr-2" /> Ana Sayfaya Dön
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;