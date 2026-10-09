-- Tint Finder catalog and private sales inbox. No anonymous lead inserts.
begin;
create table public.tint_finder_settings (
  id integer primary key default 1 check (id = 1),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.tint_finder_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  branch text not null references public.branches(slug),
  preferred_date date not null,
  vehicle_model text not null,
  answers jsonb not null,
  option_id text not null,
  recommendation jsonb not null,
  acknowledged boolean not null check (acknowledged),
  status text not null default 'new' check (status in ('new','contacted','closed'))
);
create index tint_finder_leads_created_idx on public.tint_finder_leads(created_at desc);
alter table public.tint_finder_settings enable row level security;
alter table public.tint_finder_leads enable row level security;
revoke all on public.tint_finder_settings, public.tint_finder_leads from anon, authenticated;
grant select on public.tint_finder_settings to anon, authenticated;
grant update on public.tint_finder_settings to authenticated;
grant select, update on public.tint_finder_leads to authenticated;
grant all on public.tint_finder_settings, public.tint_finder_leads to service_role;
create policy tint_settings_read on public.tint_finder_settings for select to anon, authenticated using (true);
create policy tint_settings_edit on public.tint_finder_settings for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
create policy tint_leads_read on public.tint_finder_leads for select to authenticated
  using ((select public.is_super_admin()));
create policy tint_leads_update on public.tint_finder_leads for update to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));
insert into public.tint_finder_settings (id, config) values (1, $config${
  "version": 1,
  "packages": {
    "ceramic": {
      "name": "Nano Ceramic",
      "warranty": "7 years",
      "prices": {
        "sedan": 6000,
        "suv": 8000,
        "van": 10000
      }
    },
    "pro": {
      "name": "Nano Ceramic Pro",
      "warranty": "Lifetime",
      "prices": {
        "sedan": 10000,
        "suv": 12000,
        "van": 14000
      }
    }
  },
  "films": {
    "Clear Bluish": {
      "name": "Clear Bluish",
      "package": "ceramic",
      "vlt": 68,
      "tser": 44,
      "irr": 87,
      "uvr": ">99"
    },
    "C30": {
      "name": "C30",
      "package": "ceramic",
      "vlt": 31,
      "tser": 57,
      "irr": 82,
      "uvr": ">99"
    },
    "C20": {
      "name": "C20",
      "package": "ceramic",
      "vlt": 20,
      "tser": 65,
      "irr": 93,
      "uvr": ">99"
    },
    "C08": {
      "name": "C08",
      "package": "ceramic",
      "vlt": 8,
      "tser": 69,
      "irr": 92,
      "uvr": ">99"
    },
    "HC35": {
      "name": "HC35 Nano",
      "package": "pro",
      "vlt": 35,
      "tser": 58,
      "irr": 92,
      "uvr": ">99"
    },
    "HC25": {
      "name": "HC25 Nano",
      "package": "pro",
      "vlt": 25,
      "tser": 63,
      "irr": 92,
      "uvr": ">99"
    },
    "HC15": {
      "name": "HC15 Nano",
      "package": "pro",
      "vlt": 15,
      "tser": 66,
      "irr": 92,
      "uvr": ">99"
    },
    "HC05": {
      "name": "HC05 Nano",
      "package": "pro",
      "vlt": 5,
      "tser": 71,
      "irr": 94,
      "uvr": ">99"
    }
  },
  "options": {
    "OPT-A": {
      "package": "ceramic",
      "front": "Clear Bluish",
      "rear": "Clear Bluish"
    },
    "OPT-B": {
      "package": "pro",
      "front": "HC35",
      "rear": "HC25"
    },
    "OPT-C": {
      "package": "pro",
      "front": "HC25",
      "rear": "HC15"
    },
    "OPT-D": {
      "package": "ceramic",
      "front": "C30",
      "rear": "C20"
    },
    "OPT-E": {
      "package": "pro",
      "front": "HC15",
      "rear": "HC05"
    },
    "OPT-F": {
      "package": "ceramic",
      "front": "C20",
      "rear": "C08"
    }
  },
  "rules": [
    {
      "eyesight": "poor",
      "priority": "any",
      "options": [
        "OPT-A",
        "OPT-B",
        "OPT-D"
      ]
    },
    {
      "eyesight": "excellent",
      "priority": "balance",
      "options": [
        "OPT-C",
        "OPT-D"
      ]
    },
    {
      "eyesight": "excellent",
      "priority": "privacy",
      "options": [
        "OPT-E",
        "OPT-F"
      ]
    },
    {
      "eyesight": "excellent",
      "priority": "visibility",
      "options": [
        "OPT-C",
        "OPT-D"
      ]
    },
    {
      "eyesight": "prescription",
      "priority": "balance",
      "options": [
        "OPT-B",
        "OPT-C",
        "OPT-D"
      ]
    },
    {
      "eyesight": "prescription",
      "priority": "privacy",
      "options": [
        "OPT-C",
        "OPT-D"
      ]
    },
    {
      "eyesight": "prescription",
      "priority": "visibility",
      "options": [
        "OPT-B",
        "OPT-C",
        "OPT-D"
      ]
    }
  ],
  "benefits": [
    {
      "id": "1",
      "title": "Heat Insulation",
      "description": "Blocks infrared rays so less heat gets into your car. A cooler cabin means more comfort and less strain on the AC, especially in summer."
    },
    {
      "id": "2",
      "title": "Ultra Clarity",
      "description": "High light transmission and visual clarity give you privacy and heat reduction without hurting the view of the driver or passengers."
    },
    {
      "id": "3",
      "title": "Glare Reduction",
      "description": "Softens glare from sunlight and reflections for clear, comfortable vision in bright conditions, which helps you drive more safely."
    },
    {
      "id": "4",
      "title": "UV Ray Protection",
      "description": "Blocks over 99% of UVA and UVB rays, protecting your health and helping your car\u2019s interior last longer."
    },
    {
      "id": "5",
      "title": "Scratch-resistance",
      "description": "A special coating withstands everyday rubbing, keeping the film smooth and clear for a long-lasting look."
    },
    {
      "id": "6",
      "title": "Discreet Privacy",
      "description": "Reduces how much people can see from the outside while keeping clear sightlines for you and your passengers."
    },
    {
      "id": "7",
      "title": "Shatter Protection",
      "description": "If the glass is hit, the film helps hold the pieces together, adding a layer of safety for everyone inside."
    },
    {
      "id": "8",
      "title": "Clear Signal",
      "description": "Non-metallic materials don\u2019t interfere with mobile signals, GPS, Wi-Fi, or Bluetooth, so your connections stay stable."
    },
    {
      "id": "9",
      "title": "Eco-friendly",
      "description": "Made from non-metallic, eco-friendly materials that keep environmental impact low."
    }
  ],
  "benefitRules": [
    {
      "eyesight": "poor",
      "priority": "privacy",
      "benefits": [
        "2",
        "3",
        "6"
      ]
    },
    {
      "eyesight": "poor",
      "priority": "visibility",
      "benefits": [
        "2",
        "3",
        "1"
      ]
    },
    {
      "eyesight": "poor",
      "priority": "balance",
      "benefits": [
        "2",
        "3",
        "1"
      ]
    },
    {
      "eyesight": "prescription",
      "priority": "privacy",
      "benefits": [
        "2",
        "3",
        "6"
      ]
    },
    {
      "eyesight": "prescription",
      "priority": "visibility",
      "benefits": [
        "2",
        "3",
        "4"
      ]
    },
    {
      "eyesight": "prescription",
      "priority": "balance",
      "benefits": [
        "2",
        "3",
        "1"
      ]
    },
    {
      "eyesight": "excellent",
      "priority": "privacy",
      "benefits": [
        "6",
        "3",
        "1"
      ]
    },
    {
      "eyesight": "excellent",
      "priority": "visibility",
      "benefits": [
        "2",
        "3",
        "4"
      ]
    },
    {
      "eyesight": "excellent",
      "priority": "balance",
      "benefits": [
        "2",
        "6",
        "1"
      ]
    }
  ],
  "sealEnabled": false,
  "sealVerifiedPackages": []
}
$config$::jsonb);
commit;
