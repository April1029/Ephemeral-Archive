import Link from "next/link";
import styles from "./header.module.css";

const Header = () => {
    return (
        <header className=" {styles.header}">
            <nav className=" {styles.nav}">
                <h1 className="{styles.logo}"> Now & Ever</h1>
                <ul className={styles.navLinks}>
                    <li><Link href="/">Home</Link></li>
                    <li><Link href="/journal">Capture</Link></li>
                    <li><Link href="/gallery">Gallery</Link></li>
                     <li><Link href="/about">About</Link></li>
        </ul>
            </nav>
        </header>
    )
}

export default Header;