import flet as ft
from views import LoginView, DashboardView, AgendaView, ProcessesView

def main(page: ft.Page):
    page.title = "Prazzo - Agenda Jurídica Inteligente"
    page.theme_mode = ft.ThemeMode.DARK
    
    def route_change(route):
        page.views.clear()
        
        if page.route == "/login":
            page.views.append(LoginView(page))
        elif page.route == "/dashboard":
            page.views.append(DashboardView(page))
        elif page.route == "/agenda":
            page.views.append(AgendaView(page))
        elif page.route == "/processes":
            page.views.append(ProcessesView(page))
        else:
            # Padrão vai para o login
            page.views.append(LoginView(page))
            
        page.update()

    def view_pop(view):
        page.views.pop()
        top_view = page.views[-1]
        page.go(top_view.route)

    page.on_route_change = route_change
    page.on_view_pop = view_pop
    
    page.go("/login")

if __name__ == "__main__":
    ft.app(target=main)
