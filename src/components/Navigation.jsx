import './Navigation.css';

function Navigation() {
    return (
        <nav className="nav-bar">
            <span className="nav-arrow">&lt;</span>
            <div className="nav-item">SCALES</div>
            <div className="nav-item active">SCALE MIXER</div>
            <div className="nav-item">OPTIONS</div>
            <div className="nav-item">ABOUT</div>
            <span className="nav-arrow">&gt;</span>
        </nav>
    );
}

export default Navigation;
