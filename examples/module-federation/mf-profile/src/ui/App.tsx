import {useState} from 'react';

type Profile = {
    name: string;
    email: string;
    role: string;
};

const DEFAULT_PROFILE: Profile = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    role: 'Software Engineer',
};

export default function ProfileApp() {
    const [profile, setProfile] = useState(DEFAULT_PROFILE);
    const [editing, setEditing] = useState(false);

    if (editing) {
        return (
            <section className="mf-card">
                <h2>👤 Edit profile</h2>
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        setEditing(false);
                    }}
                    style={{display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12}}
                >
                    {(['name', 'email', 'role'] as const).map((field) => (
                        <label key={field} style={{display: 'flex', flexDirection: 'column'}}>
                            <span style={{textTransform: 'capitalize', fontSize: 13}}>{field}</span>
                            <input
                                value={profile[field]}
                                onChange={(event) =>
                                    setProfile((prev) => ({...prev, [field]: event.target.value}))
                                }
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    border: '1px solid #30363d',
                                    background: '#0e1116',
                                    color: 'inherit',
                                }}
                            />
                        </label>
                    ))}
                    <div>
                        <button type="submit" className="mf-card__button">
                            Save
                        </button>
                    </div>
                </form>
            </section>
        );
    }

    return (
        <section className="mf-card">
            <h2>👤 Profile</h2>
            <p>
                Owned by the <code>mf-profile</code> microfrontend.
            </p>
            <dl style={{display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 6}}>
                <dt>Name</dt>
                <dd>{profile.name}</dd>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
                <dt>Role</dt>
                <dd>{profile.role}</dd>
            </dl>
            <button
                type="button"
                className="mf-card__button"
                style={{marginTop: 16}}
                onClick={() => setEditing(true)}
            >
                Edit
            </button>
        </section>
    );
}
