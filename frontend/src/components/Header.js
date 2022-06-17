import { NavLink } from "react-router-dom";
import "./Header.css";

function Header(props) {
  const navLinks = props.navLinks;
  return (
    <header>
      <ul>
        {Object.entries(navLinks).map((navLink) => {
          const route = navLink[0];
          const navName = navLink[1];
          return (
            <li key={route}>
              <NavLink activeClassName="active" to={route}>
                {navName}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </header>
  );
}

export default Header;
